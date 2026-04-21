/**
 * NexusBot — Objectifs Communautaires du Serveur
 * /objectifs — Créez et suivez des objectifs collectifs avec récompenses
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS server_goals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    type        TEXT NOT NULL,
    target      INTEGER NOT NULL,
    current     INTEGER DEFAULT 0,
    reward_coins INTEGER DEFAULT 0,
    reward_role  TEXT,
    reward_msg   TEXT,
    status       TEXT DEFAULT 'active',
    created_by   TEXT,
    created_at   INTEGER DEFAULT (strftime('%s','now')),
    completed_at INTEGER
  )`).run();
} catch {}

const GOAL_TYPES = {
  members:  { name: '👥 Membres',      desc: 'Atteindre X membres dans le serveur' },
  messages: { name: '💬 Messages',     desc: 'Envoyer X messages collectivement' },
  invites:  { name: '🔗 Invitations',  desc: 'Générer X invitations' },
  boosts:   { name: '🚀 Boosts',       desc: 'Atteindre X boosts Nitro' },
  manual:   { name: '⭐ Manuel',        desc: 'Objectif géré manuellement par les admins' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('objectifs')
    .setDescription('🎯 Objectifs communautaires du serveur')
    .addSubcommand(s => s.setName('voir').setDescription('📊 Voir les objectifs en cours'))
    .addSubcommand(s => s.setName('creer')
      .setDescription('➕ Créer un nouvel objectif [Admin]')
      .addStringOption(o => o.setName('titre').setDescription('Titre de l\'objectif').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('type').setDescription('Type d\'objectif').setRequired(true)
        .addChoices(
          { name: '👥 Membres', value: 'members' },
          { name: '💬 Messages', value: 'messages' },
          { name: '🔗 Invitations', value: 'invites' },
          { name: '🚀 Boosts', value: 'boosts' },
          { name: '⭐ Manuel', value: 'manual' },
        ))
      .addStringOption(o => o.setName('description').setDescription('Description').setMaxLength(300))
      .addStringOption(o => o.setName('recompense_coins').setDescription('Coins donnés à tous quand l\'objectif est atteint'))
      .addRoleOption(o => o.setName('recompense_role').setDescription('Rôle donné à tous quand atteint'))
      .addStringOption(o => o.setName('message').setDescription('Message d\'annonce quand l\'objectif est atteint')))
    .addSubcommand(s => s.setName('maj')
      .setDescription('🔄 Mettre à jour la progression d\'un objectif manuel [Admin]')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'objectif').setRequired(true))
    .addSubcommand(s => s.setName('terminer')
      .setDescription('✅ Marquer un objectif comme terminé [Admin]')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'objectif').setRequired(true)))
    .addSubcommand(s => s.setName('supprimer')
      .setDescription('🗑️ Supprimer un objectif [Admin]')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'objectif').setRequired(true)))
    .addSubcommand(s => s.setName('historique').setDescription('📜 Voir les objectifs accomplis')),

  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

    if (sub === 'voir') {
      const goals = db.db.prepare("SELECT * FROM server_goals WHERE guild_id=? AND status='active' ORDER BY created_at DESC").all(guildId);
      if (!goals.length) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setTitle('🎯 Objectifs communautaires').setDescription('Aucun objectif actif pour l\'instant.\nUn admin peut en créer avec `/objectifs creer`.').setFooter({ text: interaction.guild.name })] });
      }

      // Auto-mise à jour des objectifs auto
      for (const g of goals) {
        if (g.type === 'members') {
          const count = interaction.guild.memberCount;
          db.db.prepare('UPDATE server_goals SET current=? WHERE id=?').run(count, g.id);
          g.current = count;
        } else if (g.type === 'boosts') {
          const count = interaction.guild.premiumSubscriptionCount || 0;
          db.db.prepare('UPDATE server_goals SET current=? WHERE id=?').run(count, g.id);
          g.current = count;
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`🎯 Objectifs de ${interaction.guild.name}`)
        .setThumbnail(interaction.guild.iconURL())
        .setTimestamp();

      for (const g of goals) {
        const pct = Math.min(100, Math.round((g.current / g.target) * 100));
        const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
        const type = GOAL_TYPES[g.type] || GOAL_TYPES.manual;
        let rewardStr = '';
        if (g.reward_coins) rewardStr += `💰 ${g.reward_coins} coins`;
        if (g.reward_role) rewardStr += ` • <@&${g.reward_role}>`;
        embed.addFields({
          name: `#${g.id} ${type.name} — ${g.title}`,
          value: [
            g.description ? `*${g.description}*` : '',
            `\`${bar}\` **${pct}%**`,
            `**${g.current.toLocaleString('fr-FR')} / ${g.target.toLocaleString('fr-FR')}**`,
            rewardStr ? `🎁 Récompense : ${rewardStr}` : '',
          ].filter(Boolean).join('\n'),
          inline: false,
        });
      }
      return interaction.editReply({ embeds: [embed] });
    }

    if (!isAdmin && ['creer', 'maj', 'terminer', 'supprimer'].includes(sub)) {
      return interaction.editReply({ content: '❌ Réservé aux administrateurs.', ephemeral: true });
    }

    if (sub === 'creer') {
      const titre  = interaction.options.getString('titre');
      const type   = interaction.options.getString('type');
      const target = interaction.options.getInteger('objectif');
      const desc   = interaction.options.getString('description');
      const coins  = interaction.options.getInteger('recompense_coins') || 0;
      const role   = interaction.options.getRole('recompense_role');
      const msg    = interaction.options.getString('message');

      // Valeur initiale automatique
      let current = 0;
      if (type === 'members') current = interaction.guild.memberCount;
      else if (type === 'boosts') current = interaction.guild.premiumSubscriptionCount || 0;

      const result = db.db.prepare(`INSERT INTO server_goals (guild_id, title, type, target, current, description, reward_coins, reward_role, reward_msg, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(guildId, titre, type, target, current, desc, coins, role?.id || null, msg, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('✅ Objectif créé !')
        .addFields(
          { name: '📋 Titre',  value: titre,                           inline: true },
          { name: '🎯 Type',   value: GOAL_TYPES[type].name,           inline: true },
          { name: '🏁 Cible',  value: target.toLocaleString('fr-FR'),  inline: true },
          { name: '📊 Départ', value: current.toLocaleString('fr-FR'), inline: true },
        )
        .setFooter({ text: `ID: ${result.lastInsertRowid}` });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'maj') {
      const id  = interaction.options.getInteger('id');
      const val = interaction.options.getInteger('valeur');
      const g   = db.db.prepare("SELECT * FROM server_goals WHERE id=? AND guild_id=? AND status='active'").get(id, guildId);
      if (!g) return interaction.editReply({ content: `❌ Objectif #${id} introuvable.` });
      db.db.prepare('UPDATE server_goals SET current=? WHERE id=?').run(val, id);
      const pct = Math.min(100, Math.round((val / g.target) * 100));

      // Vérifier si complété
      if (val >= g.target) {
        db.db.prepare("UPDATE server_goals SET status='completed', completed_at=strftime('%s','now') WHERE id=?").run(id);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#f39c12').setTitle(`🎉 OBJECTIF ATTEINT — ${g.title} !`).setDescription(`✅ L'objectif a été atteint avec ${val}/${g.target} !`)] });
      }
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ Progression mise à jour : **${val}/${g.target}** (${pct}%)`)] });
    }

    if (sub === 'terminer') {
      const id = interaction.options.getInteger('id');
      const g  = db.db.prepare("SELECT * FROM server_goals WHERE id=? AND guild_id=?").get(id, guildId);
      if (!g) return interaction.editReply({ content: `❌ Objectif #${id} introuvable.` });
      db.db.prepare("UPDATE server_goals SET status='completed', completed_at=strftime('%s','now') WHERE id=?").run(id);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ Objectif **#${id} — ${g.title}** marqué comme terminé !`)] });
    }

    if (sub === 'supprimer') {
      const id = interaction.options.getInteger('id');
      db.db.prepare('DELETE FROM server_goals WHERE id=? AND guild_id=?').run(id, guildId);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`🗑️ Objectif **#${id}** supprimé.`)] });
    }

    if (sub === 'historique') {
      const done = db.db.prepare("SELECT * FROM server_goals WHERE guild_id=? AND status='completed' ORDER BY completed_at DESC LIMIT 10").all(guildId);
      if (!done.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucun objectif accompli pour l\'instant.')] });
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🏆 Objectifs accomplis')
        .setDescription(done.map(g => {
          const date = g.completed_at ? new Date(g.completed_at * 1000).toLocaleDateString('fr-FR') : '?';
          return `✅ **${g.title}** — ${GOAL_TYPES[g.type]?.name || g.type} (${date})`;
        }).join('\n'));
      return interaction.editReply({ embeds: [embed] });
    }
  }
};
