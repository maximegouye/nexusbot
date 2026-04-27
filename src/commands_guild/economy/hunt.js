const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const PREY = [
  { name: 'Lapin',       emoji: '🐰', value: [15, 50],    chance: 30 },
  { name: 'Renard',      emoji: '🦊', value: [40, 100],   chance: 22 },
  { name: 'Cerf',        emoji: '🦌', value: [80, 200],   chance: 18 },
  { name: 'Sanglier',    emoji: '🐗', value: [120, 300],  chance: 12 },
  { name: 'Ours',        emoji: '🐻', value: [250, 600],  chance: 8  },
  { name: 'Loup',        emoji: '🐺', value: [200, 500],  chance: 6  },
  { name: 'Dragon',      emoji: '🐉', value: [800, 2500], chance: 1  },
  { name: 'Rien (raté)', emoji: '💨', value: [0, 0],      chance: 10 },
  { name: 'Tu t\'es blessé !', emoji: '🩹', value: [-100, -50], chance: 3 },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chasser')
    .setDescription('🏹 Pars à la chasse pour capturer des proies ! (cooldown 45min)'),
  cooldown: 3,

  async execute(interaction) {
    try {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const cfg  = db.getConfig(interaction.guildId);
    const user = db.getUser(interaction.user.id, interaction.guildId);
    const emoji = cfg.currency_emoji || '€';
    const name  = cfg.currency_name  || 'Euros';
    const now   = Math.floor(Date.now() / 1000);
    const cd    = 2700;

    if (now - (user.last_hunt || 0) < cd) {
      const rem = cd - (now - (user.last_hunt || 0));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder().setColor('#FF6B6B').setDescription(`🏹 La forêt doit se reposer ! Reviens dans **${Math.floor(rem/60)} min**.`)],
        ephemeral: true
      });
    }

    const roll = Math.random() * 100;
    let acc = 0, prey = PREY[PREY.length - 1];
    for (const p of PREY) {
      acc += p.chance;
      if (roll < acc) { prey = p; break; }
    }

    const rawVal = prey.value[0] + Math.floor(Math.random() * Math.max(1, prey.value[1] - prey.value[0]));
    const value  = Math.abs(rawVal);
    db.db.prepare('UPDATE users SET last_hunt = ? WHERE user_id = ? AND guild_id = ?').run(now, interaction.user.id, interaction.guildId);

    if (rawVal > 0)      db.addCoins(interaction.user.id, interaction.guildId, value);
    else if (rawVal < 0) db.removeCoins(interaction.user.id, interaction.guildId, value);

    const embed = new EmbedBuilder()
      .setColor(rawVal > 500 ? '#F39C12' : rawVal > 0 ? '#2ECC71' : rawVal < 0 ? '#FF6B6B' : '#888888')
      .setTitle('🏹 Résultat de la chasse')
      .setDescription(rawVal > 0
        ? `${prey.emoji} Tu as chassé un **${prey.name}** ! +**${value.toLocaleString('fr-FR')} ${name}** ${emoji}`
        : rawVal < 0
        ? `${prey.emoji} Aïe ! Tu t'es blessé pendant la chasse. -**${value.toLocaleString('fr-FR')} ${name}** en frais médicaux !`
        : `${prey.emoji} **${prey.name}**... La forêt était vide aujourd'hui.`)
      .setFooter({ text: 'Prochaine chasse dans 45 minutes' });

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    } catch (err) {
    console.error('[CMD] Erreur:', err?.message || err);
    const _em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0,200)}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(_em).catch(() => {});
      else await interaction.reply(_em).catch(() => {});
    } catch {}
  }}
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
