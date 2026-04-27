// securite.js — Commande admin sécurité
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addBlacklist, removeBlacklist, getBlacklist, auditLog, getAuditLogs } = require('../../utils/securityManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('securite')
    .setDescription('🔒 Gestion de la sécurité du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('blacklist').setDescription('🚫 Blacklister un utilisateur')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison')))
    .addSubcommand(s => s.setName('retirer').setDescription('✅ Retirer du blacklist')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Liste des blacklistés'))
    .addSubcommand(s => s.setName('logs').setDescription('📜 Logs de sécurité')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '🔒 Réservé aux administrateurs.', ephemeral: true });
    const sub = interaction.options.getSubcommand(), guildId = interaction.guildId;
    if (sub === 'blacklist') {
      const target = interaction.options.getUser('membre'), raison = interaction.options.getString('raison') || 'Aucune raison';
      if (target.id === interaction.user.id) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Impossible de se blacklister soi-même.', ephemeral: true });
      if (target.bot) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Impossible de blacklister un bot.', ephemeral: true });
      addBlacklist(target.id, guildId, raison, interaction.user.id);
      auditLog(guildId, interaction.user.id, 'BLACKLIST', `${target.tag} ・ ${raison}`);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🚫 ・ Utilisateur blacklisté').setThumbnail(target.displayAvatarURL()).addFields({ name: '・ 👤', value: `${target}` }, { name: '・ 📝 Raison', value: raison }, { name: '・ 👮 Par', value: `${interaction.user}` }).setTimestamp()] });
    }
    if (sub === 'retirer') {
      const target = interaction.options.getUser('membre');
      if (!removeBlacklist(target.id, guildId)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ **${target.username}** n'est pas blacklisté.`, ephemeral: true });
      auditLog(guildId, interaction.user.id, 'UNBLACKLIST', target.tag);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✅ ・ Retiré du blacklist').setDescription(`${target} peut à nouveau utiliser le bot.`).setTimestamp()] });
    }
    if (sub === 'liste') {
      const list = getBlacklist(guildId);
      if (!list.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '✅ Aucun utilisateur blacklisté.', ephemeral: true });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle(`🚫 ・ Blacklist ・ ${list.length} user(s)`).setDescription(list.map(r => `・ <@${r.user_id}> — *${r.reason}*`).join('\n').slice(0,4090)).setTimestamp()], ephemeral: true });
    }
    if (sub === 'logs') {
      const logs = getAuditLogs(guildId, 15);
      if (!logs.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '📋 Aucun événement.', ephemeral: true });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('📜 ・ Logs de sécurité').setDescription(logs.map(l => `・ **${l.action}** par <@${l.user_id}> — ${l.details}`).join('\n').slice(0,4090)).setTimestamp()], ephemeral: true });
    }
  }
};