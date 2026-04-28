const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const CATCHES = [
  { name: 'Sardine',        emoji: '🐟', value: [10, 30],    chance: 30 },
  { name: 'Carpe',          emoji: '🐠', value: [20, 60],    chance: 25 },
  { name: 'Thon',           emoji: '🐡', value: [50, 120],   chance: 18 },
  { name: 'Saumon',         emoji: '🍣', value: [80, 200],   chance: 12 },
  { name: 'Homard',         emoji: '🦞', value: [150, 350],  chance: 7  },
  { name: 'Requin',         emoji: '🦈', value: [300, 700],  chance: 4  },
  { name: 'Kraken',         emoji: '🐙', value: [700, 2000], chance: 1.5},
  { name: 'Vieille botte',  emoji: '👟', value: [1, 5],      chance: 10 },
  { name: 'Rien (hameçon vide)', emoji: '🎣', value: [0, 0], chance: 8.5},
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pecher')
    .setDescription('🎣 Lance ta ligne pour attraper du poisson et gagner des € ! (cooldown 20min)'),
  cooldown: 3,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    try {
    const cfg  = db.getConfig(interaction.guildId);
    const user = db.getUser(interaction.user.id, interaction.guildId);
    const emoji = cfg.currency_emoji || '€';
    const name  = cfg.currency_name  || 'Euros';
    const now   = Math.floor(Date.now() / 1000);
    const cd    = 1200;

    if (now - (user.last_fish || 0) < cd) {
      const rem = cd - (now - (user.last_fish || 0));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder().setColor('#FF6B6B').setDescription(`🎣 L'eau est encore agitée ! Attends **${Math.floor(rem/60)} min** avant de repêcher.`)],
        ephemeral: true
      });
    }

    const roll = Math.random() * 100;
    let acc = 0, caught = CATCHES[CATCHES.length - 1];
    for (const c of CATCHES) {
      acc += c.chance;
      if (roll < acc) { caught = c; break; }
    }

    const value = caught.value[0] + Math.floor(Math.random() * Math.max(1, caught.value[1] - caught.value[0]));
    db.db.prepare('UPDATE users SET last_fish = ? WHERE user_id = ? AND guild_id = ?').run(now, interaction.user.id, interaction.guildId);
    if (value > 0) db.addCoins(interaction.user.id, interaction.guildId, value);

    const colors = { 30: '#3498DB', 25: '#2ECC71', 18: '#27AE60', 12: '#8E44AD', 7: '#E74C3C', 4: '#C0392B', 1.5: '#F39C12' };
    const embed = new EmbedBuilder()
      .setColor(value > 200 ? '#F39C12' : value > 50 ? '#3498DB' : '#888888')
      .setTitle('🎣 Résultat de la pêche')
      .setDescription(value > 0
        ? `${caught.emoji} Tu as attrapé **${caught.name}** ! Tu gagnes **${value.toLocaleString('fr-FR')} ${name}** ${emoji}`
        : `${caught.emoji} **${caught.name}**... Meilleure chance la prochaine fois !`)
      .setFooter({ text: 'Prochaine pêche dans 20 minutes' });

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    } catch {}
  }}
};
