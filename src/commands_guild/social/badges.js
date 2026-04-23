const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    badge_id TEXT, earned_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id, badge_id)
  )`).run();
} catch {}

const BADGES = {
  // Activité
  premier_message:  { name: 'Première Parole',  emoji: '💬', desc: 'Envoyer son premier message', category: '💬 Activité', hidden: false },
  bavard:           { name: 'Bavard',            emoji: '🗣️', desc: '100 messages envoyés',        category: '💬 Activité', hidden: false },
  orateur:          { name: 'Orateur',           emoji: '📢', desc: '1000 messages envoyés',       category: '💬 Activité', hidden: false },
  vocal_actif:      { name: 'Vocal Actif',       emoji: '🎙️', desc: '10h en vocal',               category: '💬 Activité', hidden: false },
  // Économie
  riche:            { name: 'Riche',             emoji: '💰', desc: 'Avoir 10 000 coins',          category: '💰 Économie', hidden: false },
  millionnaire:     { name: 'Millionnaire',      emoji: '💎', desc: 'Avoir 1 000 000 coins',       category: '💰 Économie', hidden: false },
  gambler:          { name: 'Gambler',           emoji: '🎰', desc: 'Jouer 50 fois au casino',     category: '💰 Économie', hidden: false },
  // Niveaux
  niveau_5:         { name: 'Débutant',          emoji: '⭐', desc: 'Atteindre le niveau 5',       category: '📊 Niveaux', hidden: false },
  niveau_10:        { name: 'Confirmé',          emoji: '🌟', desc: 'Atteindre le niveau 10',      category: '📊 Niveaux', hidden: false },
  niveau_25:        { name: 'Expert',            emoji: '💫', desc: 'Atteindre le niveau 25',      category: '📊 Niveaux', hidden: false },
  niveau_50:        { name: 'Légende',           emoji: '✨', desc: 'Atteindre le niveau 50',      category: '📊 Niveaux', hidden: false },
  // Social
  marie:            { name: 'Marié(e)',          emoji: '💍', desc: 'Se marier avec quelqu\'un',   category: '💕 Social', hidden: false },
  clan_chef:        { name: 'Chef de Clan',      emoji: '👑', desc: 'Créer et diriger un clan',    category: '💕 Social', hidden: false },
  // Jeux
  peche_master:     { name: 'Maître Pêcheur',   emoji: '🎣', desc: 'Pêcher 100 poissons',         category: '🎮 Jeux', hidden: false },
  mineur_pro:       { name: 'Mineur Pro',        emoji: '⛏️', desc: 'Extraire 200 minerais',      category: '🎮 Jeux', hidden: false },
  blackjack_win:    { name: 'Croupier Battu',   emoji: '🃏', desc: 'Gagner 10 parties de BJ',     category: '🎮 Jeux', hidden: false },
  donjon_profond:   { name: 'Explorateur',       emoji: '🗺️', desc: 'Atteindre l\'étage 20',      category: '🎮 Jeux', hidden: false },
  // Secrets
  lucky:            { name: 'Porte-Bonheur',     emoji: '🍀', desc: 'Déclencher un événement rare', category: '🔮 Secret', hidden: true },
  old_member:       { name: 'Vétéran',           emoji: '🛡️', desc: 'Sur le serveur depuis >1 an', category: '🔮 Secret', hidden: true },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('badges')
    .setDescription('🏅 Système de badges — Accomplissements et récompenses')
    .addSubcommand(s => s.setName('voir').setDescription('🏅 Voir vos badges')
      .addUserOption(o => o.setName('membre').setDescription('Voir les badges d\'un membre')))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir tous les badges disponibles'))
    .addSubcommand(s => s.setName('donner').setDescription('🎁 Donner un badge à un membre (Admin)')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      .addStringOption(o => o.setName('badge').setDescription('ID du badge').setRequired(true)))
    .addSubcommand(s => s.setName('retirer').setDescription('🗑️ Retirer un badge (Admin)')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      .addStringOption(o => o.setName('badge').setDescription('ID du badge').setRequired(true))),

  BADGES,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const userBadges = db.db.prepare('SELECT * FROM user_badges WHERE guild_id=? AND user_id=? ORDER BY earned_at DESC').all(guildId, target.id);

      if (!userBadges.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ ${target.id === userId ? 'Vous n\'avez' : `<@${target.id}> n'a`} aucun badge.`, ephemeral: true });

      const earned = userBadges.map(ub => {
        const b = BADGES[ub.badge_id];
        if (!b) return null;
        return `${b.emoji} **${b.name}** — ${b.desc}`;
      }).filter(Boolean).join('\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle(`🏅 Badges de ${target.username}`)
          .setDescription(earned)
          .setThumbnail(target.displayAvatarURL())
          .setFooter({ text: `${userBadges.length} badge(s) obtenu(s)` })
      ], ephemeral: target.id !== userId });
    }

    if (sub === 'liste') {
      const categories = {};
      for (const [id, b] of Object.entries(BADGES)) {
        if (b.hidden) continue;
        if (!categories[b.category]) categories[b.category] = [];
        categories[b.category].push(`${b.emoji} **${b.name}** (\`${id}\`) — ${b.desc}`);
      }

      const desc = Object.entries(categories).map(([cat, items]) => `**${cat}**\n${items.join('\n')}`).join('\n\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🏅 Badges disponibles')
          .setDescription(desc.slice(0, 4000))
          .setFooter({ text: 'Certains badges secrets ne sont pas listés' })
      ], ephemeral: true });
    }

    if (sub === 'donner') {
      if (!interaction.member.permissions.has(8n)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Admin uniquement.', ephemeral: true });
      const target = interaction.options.getUser('membre');
      const badgeId = interaction.options.getString('badge');
      if (!BADGES[badgeId]) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Badge \`${badgeId}\` inconnu.`, ephemeral: true });

      try {
        db.db.prepare('INSERT INTO user_badges (guild_id, user_id, badge_id) VALUES (?,?,?)').run(guildId, target.id, badgeId);
      } catch { return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce membre possède déjà ce badge.', ephemeral: true }); }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Badge **${BADGES[badgeId].emoji} ${BADGES[badgeId].name}** donné à <@${target.id}> !` });
    }

    if (sub === 'retirer') {
      if (!interaction.member.permissions.has(8n)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Admin uniquement.', ephemeral: true });
      const target = interaction.options.getUser('membre');
      const badgeId = interaction.options.getString('badge');
      const r = db.db.prepare('DELETE FROM user_badges WHERE guild_id=? AND user_id=? AND badge_id=?').run(guildId, target.id, badgeId);
      if (!r.changes) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ <@${target.id}> ne possède pas ce badge.`, ephemeral: true });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Badge \`${badgeId}\` retiré à <@${target.id}>.` });
    }
  }
};
