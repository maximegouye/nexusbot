const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('health')
    .setDescription('📊 Rapport de santé du serveur — analytiques avancées'),
  cooldown: 30,

  async execute(interaction) {
    await interaction.deferReply();
    const cfg   = db.getConfig(interaction.guildId);
    const guild = interaction.guild;
    await guild.fetch();

    const stats = db.getWeeklyStats(interaction.guildId);

    // Membres
    const bots    = guild.members.cache.filter(m => m.user.bot).size;
    const humans  = guild.memberCount - bots;

    // Activité récente (7 derniers jours)
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    const activeUsers  = db.db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM users WHERE guild_id = ? AND last_message > ?')
      .get(interaction.guildId, sevenDaysAgo)?.c || 0;
    const newMembers   = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id = ? AND joined_at > ?')
      .get(interaction.guildId, sevenDaysAgo)?.c || 0;
    const totalMessages = stats?.total_messages || 0;
    const giveaways     = db.db.prepare('SELECT COUNT(*) as c FROM giveaways WHERE guild_id = ? AND created_at > ?')
      .get(interaction.guildId, sevenDaysAgo)?.c || 0;

    // Score de santé (sur 100)
    let score = 50;
    const activityRate = humans > 0 ? (activeUsers / humans) * 100 : 0;
    if (activityRate > 50) score += 20;
    else if (activityRate > 25) score += 10;
    else if (activityRate < 5) score -= 10;
    if (newMembers > 5) score += 10;
    if (totalMessages > 100) score += 10;
    if (giveaways > 0) score += 5;
    if (guild.premiumSubscriptionCount > 0) score += 5;
    score = Math.min(100, Math.max(0, score));

    const scoreEmoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : score >= 40 ? '🟠' : '🔴';
    const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Bon' : score >= 40 ? 'Moyen' : 'Faible';

    // Barre de score
    const barLen  = 20;
    const filled  = Math.round(score / 100 * barLen);
    const bar     = '█'.repeat(filled) + '░'.repeat(barLen - filled);

    // Recommandations
    const tips = [];
    if (activityRate < 10) tips.push('📣 Lance des événements pour réengager ta communauté');
    if (giveaways === 0) tips.push('🎉 Lance un giveaway pour attirer de nouveaux membres');
    if (!cfg.level_channel) tips.push('⭐ Configure un canal de level up pour motiver les membres');
    if (!cfg.welcome_channel) tips.push('👋 Configure un message de bienvenue pour les nouveaux');
    if (guild.premiumSubscriptionCount === 0) tips.push('💎 Encourage les membres à booster le serveur');
    if (tips.length === 0) tips.push('✅ Ton serveur est en bonne santé, continue comme ça !');

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`📊 Rapport de santé — ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .setDescription(`**Score de santé : ${score}/100 ${scoreEmoji} ${scoreLabel}**\n${bar}`)
      .addFields(
        // Membres
        { name: '👥 Membres', value: `**${guild.memberCount}** (${humans} humains, ${bots} bots)`, inline: true },
        { name: '📥 Nouveaux (7j)', value: `**${newMembers}**`, inline: true },
        { name: '🔥 Actifs (7j)', value: `**${activeUsers}** (${Math.round(activityRate)}%)`, inline: true },
        // Activité
        { name: '💬 Messages (7j)', value: `**${totalMessages.toLocaleString('fr')}**`, inline: true },
        { name: '🎉 Giveaways (7j)', value: `**${giveaways}**`, inline: true },
        { name: '💎 Boosts', value: `**${guild.premiumSubscriptionCount || 0}** (Niv. ${guild.premiumTier})`, inline: true },
        // Recommandations
        { name: '💡 Recommandations', value: tips.slice(0, 3).join('\n'), inline: false },
      )
      .setFooter({ text: 'Rapport généré par NexusBot • Se réinitialise chaque semaine' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
