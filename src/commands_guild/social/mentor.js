// ============================================================
// mentor.js — Système de mentorat communautaire.
// Les anciens membres se déclarent "mentor" sur certains thèmes.
// Les nouveaux membres peuvent demander à être parrainés.
// Crée du lien intergénérationnel et facilite l'intégration.
// ============================================================
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// Init des tables
function initMentorTables() {
  try {
    db.db.prepare(`CREATE TABLE IF NOT EXISTS mentors (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      topics TEXT NOT NULL,
      bio TEXT,
      max_filleuls INTEGER DEFAULT 5,
      filleuls_count INTEGER DEFAULT 0,
      registered_at INTEGER,
      PRIMARY KEY (guild_id, user_id)
    )`).run();
    db.db.prepare(`CREATE TABLE IF NOT EXISTS mentor_pairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      mentor_id TEXT NOT NULL,
      filleul_id TEXT NOT NULL,
      paired_at INTEGER,
      ended_at INTEGER,
      UNIQUE(guild_id, mentor_id, filleul_id)
    )`).run();
  } catch {}
}
initMentorTables();

const TOPIC_CHOICES = [
  { name: '🎰 Casino & Jeux', value: 'casino' },
  { name: '💰 Économie & Investissement', value: 'economie' },
  { name: '🤝 Communauté & Discussion', value: 'communaute' },
  { name: '🎨 Créatif (Art, Musique, Écriture)', value: 'creatif' },
  { name: '💻 Tech & Programmation', value: 'tech' },
  { name: '📚 Études & Apprentissage', value: 'etudes' },
  { name: '🎮 Gaming', value: 'gaming' },
  { name: '🌍 Général (tout sujet)', value: 'general' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mentor')
    .setDescription('🤝 Système de mentorat — devenir mentor ou trouver un parrain')
    .addSubcommand(s => s.setName('devenir')
      .setDescription('🎓 Te déclarer mentor sur un ou plusieurs thèmes')
      .addStringOption(o => o.setName('theme').setDescription('Ton thème principal').setRequired(true).addChoices(...TOPIC_CHOICES))
      .addStringOption(o => o.setName('bio').setDescription('Une phrase qui te décrit (max 200 car)').setRequired(true).setMaxLength(200))
      .addIntegerOption(o => o.setName('max_filleuls').setDescription('Nombre max de filleuls (1-10, défaut 5)').setMinValue(1).setMaxValue(10)))
    .addSubcommand(s => s.setName('liste')
      .setDescription('📋 Voir tous les mentors disponibles')
      .addStringOption(o => o.setName('theme').setDescription('Filtrer par thème').addChoices(...TOPIC_CHOICES)))
    .addSubcommand(s => s.setName('demander')
      .setDescription('🙋 Demander un mentor sur un thème')
      .addStringOption(o => o.setName('theme').setDescription('Thème souhaité').setRequired(true).addChoices(...TOPIC_CHOICES)))
    .addSubcommand(s => s.setName('quitter')
      .setDescription('❌ Te retirer de la liste des mentors'))
    .addSubcommand(s => s.setName('mes-filleuls')
      .setDescription('👥 Voir tes filleuls actifs (mentors uniquement)')),

  ephemeral: true,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;

    // ── /mentor devenir ──────────────────────────────────────
    if (sub === 'devenir') {
      const theme = interaction.options.getString('theme');
      const bio   = interaction.options.getString('bio');
      const maxFilleuls = interaction.options.getInteger('max_filleuls') || 5;

      const existing = db.db.prepare('SELECT topics FROM mentors WHERE guild_id=? AND user_id=?').get(guildId, userId);
      let topics = existing ? JSON.parse(existing.topics || '[]') : [];
      if (!topics.includes(theme)) topics.push(theme);

      db.db.prepare(`INSERT INTO mentors (guild_id, user_id, topics, bio, max_filleuls, registered_at)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON CONFLICT(guild_id, user_id)
                     DO UPDATE SET topics=excluded.topics, bio=excluded.bio, max_filleuls=excluded.max_filleuls`)
        .run(guildId, userId, JSON.stringify(topics), bio, maxFilleuls, Math.floor(Date.now() / 1000));

      const themeLabel = TOPIC_CHOICES.find(t => t.value === theme)?.name || theme;
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Tu es maintenant mentor !')
          .setDescription([
            `**Thème** : ${themeLabel}`,
            `**Bio** : *${bio}*`,
            `**Filleuls max** : ${maxFilleuls}`,
            '',
            'Les membres peuvent te trouver via `/mentor liste` ou demander ton aide via `/mentor demander`.',
            'Tu peux ajouter d\'autres thèmes en relançant cette commande.',
          ].join('\n'))
          .setTimestamp()],
      });
    }

    // ── /mentor liste ────────────────────────────────────────
    if (sub === 'liste') {
      const themeFilter = interaction.options.getString('theme');
      const all = db.db.prepare('SELECT * FROM mentors WHERE guild_id=?').all(guildId);
      const filtered = themeFilter
        ? all.filter(m => { try { return JSON.parse(m.topics).includes(themeFilter); } catch { return false; } })
        : all;

      if (!filtered.length) {
        return interaction.editReply({
          content: themeFilter
            ? `📋 Aucun mentor disponible sur ce thème pour l'instant. Sois le premier avec \`/mentor devenir\` !`
            : '📋 Aucun mentor inscrit pour l\'instant. Sois le premier avec `/mentor devenir` !',
        });
      }

      const lines = filtered.slice(0, 25).map(m => {
        let topics = []; try { topics = JSON.parse(m.topics); } catch {}
        const topicLabels = topics.map(t => TOPIC_CHOICES.find(c => c.value === t)?.name || t).join(' · ');
        const slots = `${m.filleuls_count}/${m.max_filleuls}`;
        return `• <@${m.user_id}>\n  ${topicLabels}\n  *${(m.bio || '').slice(0, 100)}*\n  Filleuls : ${slots}`;
      }).join('\n\n');

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle(`🎓 Mentors disponibles${themeFilter ? ` — ${TOPIC_CHOICES.find(t => t.value === themeFilter)?.name}` : ''}`)
          .setDescription(lines)
          .setFooter({ text: `${filtered.length} mentor(s) · Demande-en un avec /mentor demander` })],
      });
    }

    // ── /mentor demander ─────────────────────────────────────
    if (sub === 'demander') {
      const theme = interaction.options.getString('theme');
      const themeLabel = TOPIC_CHOICES.find(t => t.value === theme)?.name || theme;
      const all = db.db.prepare('SELECT * FROM mentors WHERE guild_id=?').all(guildId);
      const available = all.filter(m => {
        try {
          if (!JSON.parse(m.topics).includes(theme)) return false;
          if (m.filleuls_count >= m.max_filleuls) return false;
          if (m.user_id === userId) return false;
          return true;
        } catch { return false; }
      });

      if (!available.length) {
        return interaction.editReply({
          content: `❌ Aucun mentor disponible sur **${themeLabel}** en ce moment. Réessaie plus tard !`,
        });
      }

      // Choisit aléatoirement un mentor
      const mentor = available[Math.floor(Math.random() * available.length)];
      // Crée la paire
      try {
        db.db.prepare('INSERT INTO mentor_pairs (guild_id, mentor_id, filleul_id, paired_at) VALUES (?, ?, ?, ?)')
          .run(guildId, mentor.user_id, userId, Math.floor(Date.now() / 1000));
        db.db.prepare('UPDATE mentors SET filleuls_count = filleuls_count + 1 WHERE guild_id=? AND user_id=?')
          .run(guildId, mentor.user_id);
      } catch {
        return interaction.editReply({ content: '❌ Tu as déjà été pairé avec ce mentor.' });
      }

      // Notifie le mentor en DM
      try {
        const mentorUser = await interaction.client.users.fetch(mentor.user_id);
        await mentorUser.send({ embeds: [new EmbedBuilder()
          .setColor('#F39C12')
          .setTitle('🎓 Nouveau filleul !')
          .setDescription(`<@${userId}> (${interaction.user.username}) souhaite être parrainé par toi sur **${themeLabel}** sur **${interaction.guild.name}**.\n\nN'hésite pas à lui envoyer un message d'accueil !`)
        ]});
      } catch {}

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Mentor trouvé !')
          .setDescription(`<@${mentor.user_id}> est ton nouveau mentor sur **${themeLabel}**.\n\n*Bio* : ${mentor.bio}\n\nIl/elle a été notifié(e) en DM. N'hésite pas à le/la contacter directement.`)
          .setFooter({ text: 'Le mentorat est libre — pas d\'obligation de réponse' })],
      });
    }

    // ── /mentor quitter ──────────────────────────────────────
    if (sub === 'quitter') {
      const result = db.db.prepare('DELETE FROM mentors WHERE guild_id=? AND user_id=?').run(guildId, userId);
      if (result.changes === 0) {
        return interaction.editReply({ content: '❌ Tu n\'es pas dans la liste des mentors.' });
      }
      return interaction.editReply({ content: '✅ Tu as quitté la liste des mentors.' });
    }

    // ── /mentor mes-filleuls ─────────────────────────────────
    if (sub === 'mes-filleuls') {
      const isMentor = db.db.prepare('SELECT 1 FROM mentors WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!isMentor) {
        return interaction.editReply({ content: '❌ Tu n\'es pas mentor. Inscris-toi avec `/mentor devenir`.' });
      }
      const pairs = db.db.prepare('SELECT * FROM mentor_pairs WHERE guild_id=? AND mentor_id=? AND ended_at IS NULL').all(guildId, userId);
      if (!pairs.length) {
        return interaction.editReply({ content: '👥 Aucun filleul actif pour le moment.' });
      }
      const lines = pairs.map(p => `• <@${p.filleul_id}> — *pairé <t:${p.paired_at}:R>*`).join('\n');
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#9B59B6')
          .setTitle(`👥 Tes filleuls (${pairs.length})`)
          .setDescription(lines)],
      });
    }
  },
};
