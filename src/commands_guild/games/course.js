const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const HORSES = [
  { name: 'Tonnerre',  emoji: '⚡', speed: 0.85, odds: 1.5 },
  { name: 'Éclair',   emoji: '💨', speed: 0.78, odds: 2.0 },
  { name: 'Pégase',   emoji: '🦄', speed: 0.65, odds: 3.5 },
  { name: 'Tornado',  emoji: '🌪️', speed: 0.90, odds: 1.2 },
  { name: 'Comète',   emoji: '☄️', speed: 0.55, odds: 5.0 },
  { name: 'Fantôme',  emoji: '👻', speed: 0.40, odds: 8.0 },
];

function runRace() {
  const results = HORSES.map(h => ({
    ...h,
    score: h.speed + (Math.random() - 0.5) * 0.4
  })).sort((a, b) => b.score - a.score);
  return results;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('course')
    .setDescription('🏇 Courses hippiques — Pariez sur le bon cheval !')
    .addSubcommand(s => s.setName('parier').setDescription('🏇 Parier sur un cheval')
      .addStringOption(o => o.setName('cheval').setDescription('Cheval sur lequel parier').setRequired(true)
        .addChoices(...HORSES.map(h => ({ name: `${h.emoji} ${h.name} (x${h.odds})`, value: h.name }))))
      .addIntegerOption(o => o.setName('mise').setDescription('Mise en coins').setRequired(true).setMinValue(10).setMaxValue(5000)))
    .addSubcommand(s => s.setName('cotes').setDescription('📊 Voir les cotes actuelles')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';

    if (sub === 'cotes') {
      const lines = HORSES.map(h => `${h.emoji} **${h.name}** — Cote: **x${h.odds}** | Vitesse estimée: ${Math.round(h.speed * 100)}%`).join('\n');
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#8B4513').setTitle('🏇 Cotes des chevaux').setDescription(lines)
          .setFooter({ text: 'Cotes × mise = gain potentiel' })
      ]});
    }

    if (sub === 'parier') {
      const chosenName = interaction.options.getString('cheval');
      const mise = interaction.options.getInteger('mise');
      const chosen = HORSES.find(h => h.name === chosenName);
      const u = db.getUser(userId, guildId);

      if (u.balance < mise) return interaction.reply({ content: `❌ Solde insuffisant.`, ephemeral: true });

      db.addCoins(userId, guildId, -mise);
      await interaction.deferReply();

      // Animation de course
      const lines = HORSES.map(h => `${h.emoji} **${h.name}** : ${'🟫'.repeat(3)}`);
      await interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#8B4513').setTitle('🏇 DÉPART !').setDescription(lines.join('\n'))
      ]});

      await new Promise(r => setTimeout(r, 2000));
      const results = runRace();
      const winner = results[0];
      const pos = results.findIndex(h => h.name === chosenName) + 1;

      const podium = results.slice(0, 3).map((h, i) => `${['🥇', '🥈', '🥉'][i]} ${h.emoji} **${h.name}**`).join('\n');

      let gain = 0;
      let resultMsg = '';
      if (pos === 1) {
        gain = Math.floor(mise * chosen.odds);
        db.addCoins(userId, guildId, gain);
        resultMsg = `🎉 Votre cheval ${chosen.emoji} **${chosen.name}** a **GAGNÉ** ! **+${gain} ${coin}**`;
      } else {
        resultMsg = `😔 Votre cheval ${chosen.emoji} **${chosen.name}** est arrivé **${pos}ème**. Perdu **${mise} ${coin}**.`;
      }

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor(pos === 1 ? '#F1C40F' : '#E74C3C').setTitle('🏇 Résultat de la course !')
          .addFields(
            { name: '🏆 Podium', value: podium, inline: true },
            { name: '🎯 Votre résultat', value: resultMsg, inline: false },
          )
      ]});
    }
  }
};
