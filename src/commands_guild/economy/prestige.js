const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

// Système de prestige : reset niveau en échange d'un bonus permanent
const PRESTIGE_LEVELS = [
  { level: 1, required_xp_level: 50, color: '#CD7F32', emoji: '🥉', bonus: '+15% XP permanent', multiplier: 1.15 },
  { level: 2, required_xp_level: 50, color: '#C0C0C0', emoji: '🥈', bonus: '+30% XP permanent', multiplier: 1.30 },
  { level: 3, required_xp_level: 50, color: '#FFD700', emoji: '🥇', bonus: '+50% XP permanent', multiplier: 1.50 },
  { level: 4, required_xp_level: 75, color: '#9B59B6', emoji: '💜', bonus: '+75% XP + 10% coins', multiplier: 1.75 },
  { level: 5, required_xp_level: 75, color: '#3498DB', emoji: '💎', bonus: '+100% XP + 20% coins', multiplier: 2.00 },
  { level: 6, required_xp_level: 100, color: '#E74C3C', emoji: '🔴', bonus: '+150% XP + 30% coins', multiplier: 2.50 },
  { level: 7, required_xp_level: 100, color: '#FF6B6B', emoji: '🌟', bonus: '+200% XP + 50% coins', multiplier: 3.00 },
  { level: 8, required_xp_level: 150, color: '#FFD700', emoji: '👑', bonus: 'LÉGENDAIRE — +300% XP + 100% coins', multiplier: 4.00 },
];

try {
  const cols = db.db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('prestige')) db.db.prepare("ALTER TABLE users ADD COLUMN prestige INTEGER DEFAULT 0").run();
  if (!cols.includes('prestige_coins_total')) db.db.prepare("ALTER TABLE users ADD COLUMN prestige_coins_total INTEGER DEFAULT 0").run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prestige')
    .setDescription('🌟 Système de prestige — Réinitialisez pour des bonus permanents !')
    .addSubcommand(s => s.setName('voir').setDescription('👁️ Voir votre prestige actuel')
      .addUserOption(o => o.setName('membre').setDescription('Voir le prestige d\'un autre membre')))
    .addSubcommand(s => s.setName('monter').setDescription('⬆️ Monter de prestige (reset niveau en échange d\'un bonus)'))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Classement des prestiges')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const u = db.getUser(target.id, guildId);
      const prestige = u.prestige || 0;
      const pData = PRESTIGE_LEVELS[prestige - 1];
      const nextP = PRESTIGE_LEVELS[prestige];

      const embed = new EmbedBuilder()
        .setColor(pData?.color || '#7B2FBE')
        .setTitle(`${pData?.emoji || '⚪'} Prestige de ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: '🌟 Prestige', value: prestige === 0 ? 'Aucun' : `**${pData?.emoji} Prestige ${prestige}**`, inline: true },
          { name: '⭐ Niveau actuel', value: `**${u.level || 1}**`, inline: true },
          { name: '💰 Coins gagnés (prestige)', value: `**${(u.prestige_coins_total || 0).toLocaleString()} ${coin}**`, inline: true },
        );

      if (pData) embed.addFields({ name: '✅ Bonus actif', value: pData.bonus, inline: false });
      if (nextP) embed.addFields({
        name: '⬆️ Prochain prestige',
        value: `Atteindre le niveau **${nextP.required_xp_level}** pour débloquer ${nextP.emoji} Prestige ${prestige + 1}\n→ ${nextP.bonus}`,
        inline: false
      });

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'monter') {
      const u = db.getUser(userId, guildId);
      const currentPrestige = u.prestige || 0;
      const nextPData = PRESTIGE_LEVELS[currentPrestige];

      if (!nextPData) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '🌟 Vous avez atteint le **prestige maximum** ! Félicitations !', ephemeral: true });

      const currentLevel = u.level || 1;
      if (currentLevel < nextPData.required_xp_level) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Vous devez être au niveau **${nextPData.required_xp_level}** minimum.\nActuellement : **${currentLevel}**`, ephemeral: true });
      }

      // Récompense de prestige
      const coinReward = 5000 * (currentPrestige + 1);

      const embed = new EmbedBuilder()
        .setColor(nextPData.color)
        .setTitle(`${nextPData.emoji} Prestige ${currentPrestige + 1} disponible !`)
        .setDescription(`Êtes-vous sûr de vouloir effectuer le prestige ? Votre niveau et XP seront **réinitialisés à 0**.\n\n**Récompenses :**`)
        .addFields(
          { name: '🌟 Nouveau bonus', value: nextPData.bonus, inline: false },
          { name: '💰 Coins de prestige', value: `**+${coinReward.toLocaleString()} ${coin}**`, inline: true },
          { name: '⚠️ Perte', value: 'Niveau & XP remis à 0', inline: true },
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`prestige_confirm_${userId}`).setLabel('✅ Confirmer le prestige').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`prestige_cancel_${userId}`).setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary),
      );

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (sub === 'top') {
      const top = db.db.prepare('SELECT user_id, prestige, level FROM users WHERE guild_id=? AND prestige > 0 ORDER BY prestige DESC, level DESC LIMIT 10').all(guildId);
      if (!top.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun membre avec du prestige sur ce serveur.', ephemeral: true });

      const desc = top.map((u, i) => {
        const pData = PRESTIGE_LEVELS[(u.prestige || 1) - 1];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i+1}.**`;
        return `${medal} <@${u.user_id}> — ${pData?.emoji || '⭐'} Prestige **${u.prestige}** • Niveau **${u.level}**`;
      }).join('\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#FFD700').setTitle('👑 Top Prestiges').setDescription(desc)
      ]});
    }
  }
};
