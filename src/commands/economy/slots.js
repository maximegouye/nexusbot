const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const SYMBOLS = [
  { emoji: '🍒', weight: 30, mult: 2 },
  { emoji: '🍋', weight: 25, mult: 3 },
  { emoji: '🍊', weight: 20, mult: 4 },
  { emoji: '🍇', weight: 15, mult: 5 },
  { emoji: '💎', weight: 7,  mult: 10 },
  { emoji: '7️⃣', weight: 3,  mult: 20 },
];

function spin() {
  const pool = SYMBOLS.flatMap(s => Array(s.weight).fill(s));
  return pool[Math.floor(Math.random() * pool.length)];
}

const cooldowns = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('🎰 Machine à sous — Tenter ta chance !')
    .addIntegerOption(o => o.setName('mise').setDescription('Montant à miser').setRequired(true).setMinValue(10).setMaxValue(50000)),

  async execute(interaction) {
    const mise   = interaction.options.getInteger('mise');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    const cd = cooldowns.get(userId);
    if (cd && Date.now() - cd < 5000) {
      return interaction.reply({ content: `⏳ Attends encore ${((5000 - (Date.now()-cd))/1000).toFixed(1)}s avant de rejouer.`, ephemeral: true });
    }
    cooldowns.set(userId, Date.now());

    const user = db.getUser(userId, guildId);
    if ((user.balance || 0) < mise) return interaction.reply({ content: `❌ Tu n'as que **${user.balance} 🪙** — mise insuffisante.`, ephemeral: true });

    // Déduire la mise
    db.db.prepare('UPDATE users SET balance=balance-? WHERE user_id=? AND guild_id=?').run(mise, userId, guildId);

    // Animer
    await interaction.deferReply();

    // Résultat
    const reels = [spin(), spin(), spin()];
    const display = reels.map(s => s.emoji).join(' | ');

    let gain = 0;
    let resultText = '';

    if (reels[0].emoji === reels[1].emoji && reels[1].emoji === reels[2].emoji) {
      // Jackpot
      gain = mise * reels[0].mult;
      resultText = reels[0].emoji === '7️⃣'
        ? `🎊 **JACKPOT ULTIME !!** x${reels[0].mult}`
        : `🎉 **JACKPOT !** x${reels[0].mult}`;
    } else if (reels[0].emoji === reels[1].emoji || reels[1].emoji === reels[2].emoji || reels[0].emoji === reels[2].emoji) {
      // Deux identiques
      const sym = reels[0].emoji === reels[1].emoji ? reels[0] : reels[2].emoji === reels[1].emoji ? reels[1] : reels[0];
      gain = Math.floor(mise * 1.5);
      resultText = `✨ **Deux identiques !** x1.5`;
    } else {
      resultText = '😞 Aucune combinaison — Réessaie !';
    }

    if (gain > 0) {
      db.db.prepare('UPDATE users SET balance=balance+?, total_earned=total_earned+? WHERE user_id=? AND guild_id=?').run(gain, gain, userId, guildId);
    }

    const net    = gain - mise;
    const color  = gain > mise ? 'Green' : gain > 0 ? 'Yellow' : 'Red';
    const newBal = (user.balance || 0) - mise + gain;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🎰 Machine à Sous')
      .setDescription(`╔══════════════╗\n║  ${display}  ║\n╚══════════════╝\n\n${resultText}`)
      .addFields(
        { name: '💰 Mise',     value: `${mise} 🪙`, inline: true },
        { name: '🏆 Gain',     value: `${gain} 🪙`, inline: true },
        { name: net >= 0 ? '📈 Bénéfice' : '📉 Perte', value: `${net > 0 ? '+' : ''}${net} 🪙`, inline: true },
        { name: '💳 Solde',    value: `${newBal} 🪙`, inline: true },
      )
      .setFooter({ text: `${interaction.user.username} • /slots` });

    return interaction.editReply({ embeds: [embed] });
  }
};
