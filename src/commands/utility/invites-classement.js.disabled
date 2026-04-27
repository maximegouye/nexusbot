// ============================================================
// invites-classement.js — Leaderboard des meilleurs inviteurs
// ============================================================
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

// Création tables si inexistantes
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS invites (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    inviter_id TEXT NOT NULL,
    invitee_id TEXT NOT NULL,
    invite_code TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    left_at    TEXT
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS invite_role_rewards (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    invite_count INTEGER NOT NULL,
    role_id      TEXT NOT NULL,
    UNIQUE(guild_id, invite_count)
  )`).run();
} catch {}

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites-classement')
    .setDescription('🏆 Classement des membres qui ont invité le plus de personnes')
    .addSubcommand(s => s
      .setName('top')
      .setDescription('📊 Voir le top des inviteurs'))
    .addSubcommand(s => s
      .setName('moi')
      .setDescription('📬 Voir mes statistiques d\'invitation')
      .addUserOption(o => o.setName('membre').setDescription('Voir les stats d\'un autre membre')))
    .addSubcommand(s => s
      .setName('config-roles')
      .setDescription('⚙️ [Admin] Configurer les rôles de récompense par palier')
      .addIntegerOption(o => o.setName('palier').setDescription('Nombre d\'invitations requis').setRequired(true).setMinValue(1))
      .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer (vide = supprimer)').setRequired(false))),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const cfg     = db.getConfig ? db.getConfig(guildId) : null;
    const coin    = cfg?.currency_emoji || '🪙';

    // ── TOP ──────────────────────────────────────────────
    if (sub === 'top') {
      const rows = db.db.prepare(`
        SELECT inviter_id, COUNT(*) as total
        FROM invites
        WHERE guild_id = ?
        GROUP BY inviter_id
        ORDER BY total DESC
        LIMIT 10
      `).all(guildId);

      if (!rows.length) {
        return interaction.editReply({ content: '📭 Aucune invitation enregistrée pour le moment.' });
      }

      const lines = await Promise.all(rows.map(async (r, i) => {
        try {
          const u = await interaction.client.users.fetch(r.inviter_id);
          return `${MEDALS[i] || `**${i + 1}.**`} **${u.username}** — ${r.total} invitation(s)`;
        } catch {
          return `${MEDALS[i] || `**${i + 1}.**`} <@${r.inviter_id}> — ${r.total} invitation(s)`;
        }
      }));

      // Rang de l'appelant
      const allRanks = db.db.prepare(`
        SELECT inviter_id, COUNT(*) as total
        FROM invites WHERE guild_id = ?
        GROUP BY inviter_id ORDER BY total DESC
      `).all(guildId);
      const myRank = allRanks.findIndex(r => r.inviter_id === interaction.user.id) + 1;
      const myTotal = allRanks.find(r => r.inviter_id === interaction.user.id)?.total || 0;

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🏆 Top des Inviteurs')
        .setDescription(lines.join('\n'))
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setFooter({ text: myRank > 0 ? `Votre rang : #${myRank} (${myTotal} invitations)` : 'Vous n\'avez pas encore invité de membres' })
        .setTimestamp();

      // Afficher les rôles paliers configurés
      const roleRewards = db.db.prepare(
        'SELECT invite_count, role_id FROM invite_role_rewards WHERE guild_id=? ORDER BY invite_count ASC'
      ).all(guildId);
      if (roleRewards.length) {
        const rewardLines = roleRewards.map(r => `${r.invite_count} invitations → <@&${r.role_id}>`).join('\n');
        embed.addFields({ name: '🎁 Récompenses', value: rewardLines, inline: false });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ── MOI ──────────────────────────────────────────────
    if (sub === 'moi') {
      const target = interaction.options.getUser('membre') || interaction.user;

      const stats = db.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN left_at IS NULL THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN left_at IS NOT NULL THEN 1 ELSE 0 END) as left_count
        FROM invites
        WHERE guild_id=? AND inviter_id=?
      `).get(guildId, target.id) || { total: 0, present: 0, left_count: 0 };

      const rank = (() => {
        const all = db.db.prepare(`
          SELECT inviter_id FROM invites WHERE guild_id=?
          GROUP BY inviter_id ORDER BY COUNT(*) DESC
        `).all(guildId);
        return (all.findIndex(r => r.inviter_id === target.id) + 1) || null;
      })();

      // Prochain palier
      const nextPalier = db.db.prepare(
        'SELECT invite_count, role_id FROM invite_role_rewards WHERE guild_id=? AND invite_count>? ORDER BY invite_count ASC LIMIT 1'
      ).get(guildId, stats.total);

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle(`📬 Invitations de ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: '✅ Total invités',    value: `**${stats.total}**`,        inline: true },
          { name: '🟢 Encore présents', value: `**${stats.present}**`,       inline: true },
          { name: '🔴 Partis',          value: `**${stats.left_count}**`,    inline: true },
          { name: '🏆 Classement',      value: rank ? `**#${rank}**` : '*Non classé*', inline: true },
        )
        .setTimestamp();

      if (nextPalier) {
        const remaining = nextPalier.invite_count - stats.total;
        embed.addFields({
          name: '🎁 Prochain palier',
          value: `Plus que **${remaining}** invitation(s) pour débloquer <@&${nextPalier.role_id}> !`,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ── CONFIG-ROLES (admin) ──────────────────────────────
    if (sub === 'config-roles') {
      const member = interaction.member;
      if (!member.permissions.has('ManageGuild') && !member.permissions.has('Administrator')) {
        return interaction.editReply({ content: '❌ Réservé aux administrateurs.', ephemeral: true });
      }

      const palier = interaction.options.getInteger('palier');
      const role   = interaction.options.getRole('role');

      if (role) {
        db.db.prepare(
          'INSERT OR REPLACE INTO invite_role_rewards (guild_id, invite_count, role_id) VALUES (?,?,?)'
        ).run(guildId, palier, role.id);
        return interaction.editReply({
          content: `✅ Palier configuré : **${palier} invitations** → ${role} !`,
        });
      } else {
        db.db.prepare(
          'DELETE FROM invite_role_rewards WHERE guild_id=? AND invite_count=?'
        ).run(guildId, palier);
        return interaction.editReply({
          content: `✅ Récompense pour le palier **${palier} invitations** supprimée.`,
        });
      }
    }
  },

  // Préfixe &invites-classement / &ic
  name: 'invites-classement',
  aliases: ['ic', 'invite-top', 'inviteurs'],
  async run(message) {
    const rows = db.db.prepare(`
      SELECT inviter_id, COUNT(*) as total FROM invites
      WHERE guild_id=? GROUP BY inviter_id ORDER BY total DESC LIMIT 10
    `).all(message.guildId);

    if (!rows.length) return message.reply('📭 Aucune invitation enregistrée.');

    const lines = await Promise.all(rows.map(async (r, i) => {
      const u = await message.client.users.fetch(r.inviter_id).catch(() => null);
      return `${MEDALS[i] || `${i + 1}.`} **${u?.username || r.inviter_id}** — ${r.total} invitation(s)`;
    }));

    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🏆 Top des Inviteurs')
        .setDescription(lines.join('\n'))
        .setTimestamp()],
    });
  },
};
