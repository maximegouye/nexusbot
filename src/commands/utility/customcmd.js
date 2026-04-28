const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('customcmd')
    .setDescription('🤖 Créer des commandes personnalisées (réponses automatiques)')
    .addSubcommand(s => s.setName('ajouter').setDescription('➕ Créer une réponse automatique')
      .addStringOption(o => o.setName('declencheur').setDescription('Mot ou phrase qui déclenche la réponse').setRequired(true).setMaxLength(50))
      .addStringOption(o => o.setName('reponse').setDescription('Réponse du bot. Variables : {user} {username} {server}').setRequired(true).setMaxLength(1000)))
    .addSubcommand(s => s.setName('supprimer').setDescription('➖ Supprimer une réponse automatique')
      .addStringOption(o => o.setName('declencheur').setDescription('Déclencheur à supprimer').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir toutes les réponses automatiques'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  cooldown: 3,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    try {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Permission insuffisante.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'ajouter') {
      const declencheur = interaction.options.getString('declencheur').toLowerCase().trim();
      const reponse     = interaction.options.getString('reponse');

      await db.db.prepare(`
        INSERT INTO custom_commands (guild_id, trigger, response, created_by) VALUES (?, ?, ?, ?)
        ON CONFLICT(guild_id, trigger) DO UPDATE SET response = ?, created_by = ?
      `).run(interaction.guildId, declencheur, reponse, interaction.user.id, reponse, interaction.user.id);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Commande Personnalisée Créée !')
          .addFields(
            { name: '🎯 Déclencheur', value: `\`${declencheur}\``, inline: true },
            { name: '💬 Réponse', value: reponse.slice(0, 256), inline: false },
          )
          .setFooter({ text: 'Variables disponibles : {user} {username} {server}' })
        ], ephemeral: true
      });
    }

    if (sub === 'supprimer') {
      const declencheur = interaction.options.getString('declencheur').toLowerCase().trim();
      const cmd = db.getCustomCommand(interaction.guildId, declencheur);
      if (!cmd) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Aucune commande pour \`${declencheur}\`.`, ephemeral: true });
      await db.db.prepare('DELETE FROM custom_commands WHERE guild_id = ? AND LOWER(trigger) = LOWER(?)').run(interaction.guildId, declencheur);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder().setColor('#E74C3C').setDescription(`🗑️ Commande \`${declencheur}\` supprimée.`)], ephemeral: true
      });
    }

    if (sub === 'liste') {
      const cmds = db.getCustomCommands(interaction.guildId);
      if (!cmds.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune commande personnalisée configurée.', ephemeral: true });

      const list = cmds.map(c => `• \`${c.trigger}\` → ${c.response.slice(0, 50)}${c.response.length > 50 ? '...' : ''}`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('🤖 Commandes Personnalisées')
          .setDescription(list.slice(0, 4096))
          .setFooter({ text: `${cmds.length} commande${cmds.length > 1 ? 's' : ''}` })
        ]
      });
    }
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
