// ============================================================
// activity-roles.js — Rôles automatiques par activité (XP/messages)
// Emplacement : src/commands_guild/utility/activity-roles.js
// ============================================================
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// Table des paliers d'activité
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS activity_role_rewards (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    type         TEXT NOT NULL DEFAULT 'xp',   -- 'xp' | 'messages' | 'level'
    threshold    INTEGER NOT NULL,
    role_id      TEXT NOT NULL,
    UNIQUE(guild_id, type, threshold)
  )`).run();
} catch {}

module.exports = {
  // ⚠️ setDefaultMemberPermissions est appliqué AU TOP-LEVEL (pas sur subcommands).
  // Discord.js v14+ : les subcommand builders n'exposent pas cette méthode.
  data: new SlashCommandBuilder()
    .setName('activity-roles')
    .setDescription('⚙️ Gérer les rôles attribués automatiquement selon l\'activité')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('voir')
      .setDescription('📋 Voir les paliers d\'activité configurés'))
    .addSubcommand(s => s
      .setName('ajouter')
      .setDescription('➕ Ajouter un palier d\'activité')
      .addStringOption(o => o.setName('type').setDescription('Type de palier').setRequired(true)
        .addChoices(
          { name: '⭐ XP total', value: 'xp' },
          { name: '💬 Messages', value: 'messages' },
          { name: '🏆 Niveau',   value: 'level' },
        ))
      .addIntegerOption(o => o.setName('seuil').setDescription('Valeur à atteindre (ex: 1000 XP, 500 msgs, niveau 5)').setRequired(true).setMinValue(1))
      .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer').setRequired(true)))
    .addSubcommand(s => s
      .setName('supprimer')
      .setDescription('🗑️ Supprimer un palier')
      .addStringOption(o => o.setName('type').setDescription('Type de palier').setRequired(true)
        .addChoices(
          { name: '⭐ XP total', value: 'xp' },
          { name: '💬 Messages', value: 'messages' },
          { name: '🏆 Niveau',   value: 'level' },
        ))
      .addIntegerOption(o => o.setName('seuil').setDescription('Seuil à supprimer').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s
      .setName('verifier')
      .setDescription('🔄 Vérifier et attribuer les rôles à tous les membres (peut être lent)')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ── VOIR ─────────────────────────────────────────────
    if (sub === 'voir') {
      const paliers = db.db.prepare(
        'SELECT type, threshold, role_id FROM activity_role_rewards WHERE guild_id=? ORDER BY type, threshold ASC'
      ).all(guildId);

      if (!paliers.length) {
        return interaction.editReply({
          content: '📭 Aucun palier d\'activité configuré.\nUtilisez `/activity-roles ajouter` pour en créer un.',
        });
      }

      const TYPE_LABELS = { xp: '⭐ XP', messages: '💬 Messages', level: '🏆 Niveau' };
      const grouped = {};
      for (const p of paliers) {
        if (!grouped[p.type]) grouped[p.type] = [];
        grouped[p.type].push(p);
      }

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎖️ Paliers d\'activité')
        .setDescription('Les rôles suivants sont attribués automatiquement quand un membre atteint le seuil requis.')
        .setTimestamp();

      for (const [type, items] of Object.entries(grouped)) {
        const lines = items.map(p => `• **${p.threshold}** ${TYPE_LABELS[type] || type} → <@&${p.role_id}>`).join('\n');
        embed.addFields({ name: TYPE_LABELS[type] || type, value: lines, inline: false });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ── AJOUTER ──────────────────────────────────────────
    if (sub === 'ajouter') {
      const type   = interaction.options.getString('type');
      const seuil  = interaction.options.getInteger('seuil');
      const role   = interaction.options.getRole('role');

      if (role.managed || role.id === guildId) {
        return interaction.editReply({ content: '❌ Ce rôle ne peut pas être attribué.' });
      }

      db.db.prepare(
        'INSERT OR REPLACE INTO activity_role_rewards (guild_id, type, threshold, role_id) VALUES (?,?,?,?)'
      ).run(guildId, type, seuil, role.id);

      const TYPE_LABELS = { xp: 'XP', messages: 'messages', level: 'niveau' };
      return interaction.editReply({
        content: `✅ Palier ajouté : atteindre **${seuil} ${TYPE_LABELS[type]}** → ${role}`,
      });
    }

    // ── SUPPRIMER ─────────────────────────────────────────
    if (sub === 'supprimer') {
      const type  = interaction.options.getString('type');
      const seuil = interaction.options.getInteger('seuil');

      const changes = db.db.prepare(
        'DELETE FROM activity_role_rewards WHERE guild_id=? AND type=? AND threshold=?'
      ).run(guildId, type, seuil).changes;

      return interaction.editReply({
        content: changes > 0 ? `✅ Palier supprimé.` : `❌ Palier introuvable.`,
      });
    }

    // ── VERIFIER (attribution en masse) ──────────────────
    if (sub === 'verifier') {
      const paliers = db.db.prepare(
        'SELECT type, threshold, role_id FROM activity_role_rewards WHERE guild_id=? ORDER BY threshold ASC'
      ).all(guildId);

      if (!paliers.length) {
        return interaction.editReply({ content: '📭 Aucun palier configuré.' });
      }

      await interaction.editReply({ content: '⏳ Vérification en cours... (peut prendre quelques secondes)' });

      const users = db.db.prepare(
        'SELECT user_id, xp, level, message_count FROM users WHERE guild_id=?'
      ).all(guildId);

      let assigned = 0;
      for (const u of users) {
        try {
          const member = await interaction.guild.members.fetch(u.user_id).catch(() => null);
          if (!member) continue;

          for (const palier of paliers) {
            let val = 0;
            if (palier.type === 'xp')       val = u.xp || 0;
            if (palier.type === 'messages')  val = u.message_count || 0;
            if (palier.type === 'level')     val = u.level || 0;

            if (val >= palier.threshold) {
              const role = interaction.guild.roles.cache.get(palier.role_id);
              if (role && !member.roles.cache.has(palier.role_id)) {
                await member.roles.add(role).catch(() => {});
                assigned++;
              }
            }
          }
        } catch {}
      }

      return interaction.editReply({
        content: `✅ Vérification terminée — **${assigned}** rôle(s) attribué(s) au total.`,
      });
    }
  },
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
