/**
 * NexusBot — Suivi d'Humeur (Mood Tracker)
 * /humeur — Enregistre ton humeur quotidienne et suis tes tendances
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS mood_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    guild_id   TEXT NOT NULL,
    mood       INTEGER NOT NULL,
    emoji      TEXT,
    note       TEXT,
    logged_at  INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

const MOODS = [
  { value: 1, emoji: '😭', label: 'Terrible',    color: '#e74c3c' },
  { value: 2, emoji: '😢', label: 'Triste',       color: '#e67e22' },
  { value: 3, emoji: '😐', label: 'Bof',          color: '#95a5a6' },
  { value: 4, emoji: '🙂', label: 'Bien',         color: '#2ecc71' },
  { value: 5, emoji: '😄', label: 'Super bien',   color: '#f39c12' },
  { value: 6, emoji: '🤩', label: 'Incroyable !', color: '#9b59b6' },
];

function getMoodInfo(value) {
  return MOODS.find(m => m.value === value) || MOODS[2];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('humeur')
    .setDescription('😊 Suivi d\'humeur quotidien')
    .addSubcommand(s => s.setName('noter')
      .setDescription('📝 Enregistrer ton humeur du jour')
      .addIntegerOption(o => o.setName('humeur').setDescription('Ton humeur (1=Terrible → 6=Incroyable)').setRequired(true).setMinValue(1).setMaxValue(6))
      .addStringOption(o => o.setName('note').setDescription('Note optionnelle sur ton humeur').setMaxLength(200)))
    .addSubcommand(s => s.setName('voir').setDescription('📊 Voir ton historique d\'humeur'))
    .addSubcommand(s => s.setName('stats').setDescription('📈 Voir tes statistiques d\'humeur'))
    .addSubcommand(s => s.setName('serveur').setDescription('🌍 Voir l\'humeur générale du serveur aujourd\'hui')),

  cooldown: 60, // 1 minute entre les entrées

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;

    if (sub === 'noter') {
      const moodVal = interaction.options.getInteger('humeur');
      const note    = interaction.options.getString('note');
      const mood    = getMoodInfo(moodVal);

      // Vérifie si déjà loggé aujourd'hui (même jour)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTs = Math.floor(today.getTime() / 1000);
      const existing = db.db.prepare('SELECT * FROM mood_logs WHERE user_id=? AND guild_id=? AND logged_at>=?').get(userId, guildId, todayTs);

      if (existing) {
        // Mise à jour
        db.db.prepare('UPDATE mood_logs SET mood=?, emoji=?, note=?, logged_at=strftime(\'%s\',\'now\') WHERE id=?').run(moodVal, mood.emoji, note, existing.id);
      } else {
        db.db.prepare('INSERT INTO mood_logs (user_id, guild_id, mood, emoji, note) VALUES (?,?,?,?,?)').run(userId, guildId, moodVal, mood.emoji, note);
        // Bonus coins pour enregistrer son humeur
        db.addCoins(userId, guildId, 25);
      }

      const messages = {
        1: ['Courage, ça ira mieux ! 💪', 'On est là pour toi ❤️', 'N\'oublie pas de prendre soin de toi.'],
        2: ['Ça va aller mieux 🌈', 'Parle à quelqu\'un si besoin 💙', 'Chaque jour est une nouvelle chance.'],
        3: ['Les journées normales ont aussi leur importance 😌', 'Prends le temps de souffler.', 'Demain sera peut-être mieux !'],
        4: ['Content de l\'entendre ! 😊', 'Continue comme ça !', 'Belle journée à toi !'],
        5: ['Super ! Profite bien ! 🌟', 'Ton énergie positive illumine tout !', 'Continue sur cette lancée !'],
        6: ['WOW ! Quelle énergie ! 🚀', 'Partage ta joie avec le monde !', 'Tu es au top !'],
      };
      const msg = messages[moodVal][Math.floor(Math.random() * 3)];

      const embed = new EmbedBuilder()
        .setColor(mood.color)
        .setTitle(`${mood.emoji} Humeur enregistrée !`)
        .addFields(
          { name: 'Humeur',  value: `${mood.emoji} **${mood.label}** (${moodVal}/6)`, inline: true },
          { name: '🪙 Bonus', value: existing ? '(Déjà enregistrée aujourd\'hui)' : '+25 coins !',          inline: true },
        );
      if (note) embed.addFields({ name: '📝 Ta note', value: note, inline: false });
      embed.setFooter({ text: msg });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'voir') {
      const logs = db.db.prepare('SELECT * FROM mood_logs WHERE user_id=? AND guild_id=? ORDER BY logged_at DESC LIMIT 14').all(userId, guildId);
      if (!logs.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucune entrée d\'humeur. Commence avec `/humeur noter` !')] });

      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('📊 Ton Historique d\'Humeur')
        .setThumbnail(interaction.user.displayAvatarURL())
        .setDescription(logs.map(l => {
          const date = new Date(l.logged_at * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
          const mood = getMoodInfo(l.mood);
          return `**${date}** — ${mood.emoji} ${mood.label}${l.note ? ` — *${l.note.slice(0,50)}*` : ''}`;
        }).join('\n'));

      // Mood graph (text-based)
      const graph = logs.slice(0, 7).reverse().map(l => {
        const bars = '█'.repeat(l.mood) + '░'.repeat(6 - l.mood);
        const date = new Date(l.logged_at * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        return `${date} \`${bars}\` ${l.mood}/6`;
      }).join('\n');
      embed.addFields({ name: '📈 7 derniers jours', value: graph, inline: false });

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'stats') {
      const stats = db.db.prepare('SELECT AVG(mood) as avg, MIN(mood) as min, MAX(mood) as max, COUNT(*) as total FROM mood_logs WHERE user_id=? AND guild_id=?').get(userId, guildId);
      if (!stats.total) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Pas encore de données.')] });

      const avgMood = getMoodInfo(Math.round(stats.avg));
      const streak  = getMoodStreak(userId, guildId);

      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('📈 Statistiques d\'Humeur')
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '📊 Moyenne',     value: `${avgMood.emoji} **${stats.avg.toFixed(1)}/6** (${avgMood.label})`, inline: true },
          { name: '⬆️ Maximum',    value: getMoodInfo(stats.max).emoji + ' ' + getMoodInfo(stats.max).label, inline: true },
          { name: '⬇️ Minimum',    value: getMoodInfo(stats.min).emoji + ' ' + getMoodInfo(stats.min).label, inline: true },
          { name: '📝 Total entrées', value: `${stats.total}`, inline: true },
          { name: '🔥 Streak',     value: `${streak} jour(s) consécutifs`, inline: true },
        );
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'serveur') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTs = Math.floor(today.getTime() / 1000);
      const todayLogs = db.db.prepare('SELECT * FROM mood_logs WHERE guild_id=? AND logged_at>=?').all(guildId, todayTs);

      if (!todayLogs.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Personne n\'a encore enregistré son humeur aujourd\'hui !')] });

      const avgMood = todayLogs.reduce((s, l) => s + l.mood, 0) / todayLogs.length;
      const avgInfo = getMoodInfo(Math.round(avgMood));
      const distribution = MOODS.map(m => {
        const count = todayLogs.filter(l => l.mood === m.value).length;
        const pct   = Math.round((count / todayLogs.length) * 10);
        return `${m.emoji} \`${'█'.repeat(pct)}${'░'.repeat(10-pct)}\` ${count}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(avgInfo.color)
        .setTitle(`🌍 Humeur du Serveur — Aujourd'hui`)
        .setThumbnail(interaction.guild.iconURL())
        .addFields(
          { name: '😊 Humeur moyenne',  value: `${avgInfo.emoji} **${avgMood.toFixed(1)}/6** (${avgInfo.label})`, inline: true },
          { name: '👥 Participants',    value: `${todayLogs.length} membres`, inline: true },
          { name: '📊 Distribution',   value: distribution, inline: false },
        )
        .setFooter({ text: 'Enregistre la tienne avec /humeur noter !' });
      return interaction.editReply({ embeds: [embed] });
    }
  }
};

function getMoodStreak(userId, guildId) {
  const logs = db.db.prepare('SELECT DATE(logged_at, \'unixepoch\') as day FROM mood_logs WHERE user_id=? AND guild_id=? GROUP BY day ORDER BY day DESC').all(userId, guildId);
  if (!logs.length) return 0;
  let streak = 1;
  for (let i = 1; i < logs.length; i++) {
    const d1 = new Date(logs[i-1].day);
    const d2 = new Date(logs[i].day);
    const diff = (d1 - d2) / (1000 * 60 * 60 * 24);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}
