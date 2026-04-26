const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function trackMission(userId, guildId, type, amount = 1) {
  try { require('../../commands_guild/unique/missions').progressMission(userId, guildId, type, amount); } catch {}
}

const JOBS = [
  { name: 'Développeur',    emoji: '💻', min: 18, max: 45 },
  { name: 'Médecin',        emoji: '🩺', min: 22, max: 55 },
  { name: 'Chef cuisto',    emoji: '👨‍🍳', min: 12, max: 30 },
  { name: 'Pilote',         emoji: '✈️', min: 20, max: 50 },
  { name: 'Pompier',        emoji: '🔥', min: 15, max: 38 },
  { name: 'Détective',      emoji: '🕵️', min: 18, max: 42 },
  { name: 'Astronaute',     emoji: '🚀', min: 25, max: 65 },
  { name: 'Musicien',       emoji: '🎵', min: 8,  max: 35 },
  { name: 'Streamer',       emoji: '🎮', min: 5,  max: 80 },
  { name: 'YouTubeur',      emoji: '📹', min: 3,  max: 90 },
  { name: 'Trader',         emoji: '📈', min: 2,  max: 120 },
  { name: 'Agriculteur',    emoji: '🌾', min: 10, max: 28 },
  { name: 'Chirurgien',     emoji: '🔪', min: 25, max: 60 },
  { name: 'Boxeur',         emoji: '🥊', min: 15, max: 45 },
  { name: 'Inventeur',      emoji: '💡', min: 12, max: 70 },
  { name: 'Architecte',     emoji: '🏗️', min: 20, max: 52 },
  { name: 'Journaliste',    emoji: '📰', min: 14, max: 36 },
  { name: 'Chauffeur',      emoji: '🚗', min: 10, max: 25 },
  { name: 'Pharmacien',     emoji: '💊', min: 20, max: 48 },
  { name: 'Graphiste',      emoji: '🎨', min: 15, max: 40 },
];

const PHRASES = [
  'Tu as passé la journée à travailler comme **{job}** et tu as gagné',
  'Après une longue journée en tant que **{job}**, tu rapportes',
  'Tu as brillé comme **{job}** et tu empoches',
  'Mission accomplie ! En tant que **{job}**, tu reçois',
  'Ton patron est ravi de toi ! Tu gagnes',
  'Tu as travaillé dur toute la journée. Résultat :',
  'Une journée bien remplie en tant que **{job}** — tu encaisses',
];

const WORK_FRAMES = [
  (job) => `\`\`\`\n🚶  En route vers le bureau...\n${'▓'.repeat(5)}${'░'.repeat(15)}\n\`\`\``,
  (job) => `\`\`\`\n${job.emoji}  En plein travail en tant que ${job.name}...\n${'▓'.repeat(12)}${'░'.repeat(8)}\n\`\`\``,
  (job) => `\`\`\`\n📊  Calcul du salaire...\n${'▓'.repeat(18)}${'░'.repeat(2)}\n\`\`\``,
];

module.exports = {
  name: 'work',
  aliases: ['travailler', 'boulot', 'travail'],
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('💼 Travaille pour gagner des euros (cooldown 1h)'),
  cooldown: 3,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';

    const now      = Math.floor(Date.now() / 1000);
    const lastWork = user.last_work || 0;
    const cooldown = cfg.work_cooldown > 0 ? cfg.work_cooldown : 3600;

    if (now - lastWork < cooldown) {
      const remaining = cooldown - (now - lastWork);
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('😴 Tu es fatigué !')
          .setDescription(`Repose-toi encore **${h > 0 ? h + 'h ' : ''}${m}min** avant de retravailler.`)
          .setFooter({ text: '💡 Utilise /daily et /crime pour gagner plus !' })
        ], ephemeral: true
      });
    }

    const job = JOBS[Math.floor(Math.random() * JOBS.length)];
    const gMin = (cfg.work_min != null && cfg.work_min > 0) ? cfg.work_min : job.min;
    const gMax = (cfg.work_max != null && cfg.work_max > 0) ? cfg.work_max : job.max;
    const [lo, hi] = gMin <= gMax ? [gMin, gMax] : [gMax, gMin];
    const earned = Math.floor(Math.random() * (hi - lo + 1)) + lo;
    const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)].replace('{job}', job.name);

    const lastWorkDate  = lastWork > 0 ? new Date(lastWork * 1000).toDateString() : null;
    const yesterdayDate = new Date(Date.now() - 86400000).toDateString();
    const workStreak = (lastWorkDate === yesterdayDate) ? (user.work_streak || 0) + 1 : 1;
    const streakBonus = workStreak >= 3 ? Math.floor(earned * 0.15) : 0;
    const total = earned + streakBonus;

    // ── Animation de travail ──────────────────────────────
    const replyFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
    await replyFn({ embeds: [new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`💼 Au travail !`)
      .setDescription(WORK_FRAMES[0](job))
      .setFooter({ text: 'Patience...' })
    ]}).catch(() => {});

    await sleep(700);
    await interaction.editReply({ embeds: [new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`${job.emoji} En plein boulot !`)
      .setDescription(WORK_FRAMES[1](job))
      .setFooter({ text: job.name })
    ]}).catch(() => {});

    await sleep(700);
    await interaction.editReply({ embeds: [new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle('📊 Calcul du salaire...')
      .setDescription(WORK_FRAMES[2](job))
      .setFooter({ text: 'Presque !' })
    ]}).catch(() => {});

    await sleep(700);

    // ── Sauvegarde ────────────────────────────────────────
    db.addCoins(interaction.user.id, interaction.guildId, total);
    db.db.prepare('UPDATE users SET last_work = ?, work_streak = ? WHERE user_id = ? AND guild_id = ?')
      .run(now, workStreak, interaction.user.id, interaction.guildId);
    trackMission(interaction.user.id, interaction.guildId, 'work');
    trackMission(interaction.user.id, interaction.guildId, 'earn_coins', total);

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`${job.emoji} Journée terminée !`)
      .setDescription(`${phrase} **${total.toLocaleString('fr-FR')}${symbol}**${streakBonus > 0 ? ` *(+${streakBonus}${symbol} bonus streak 🔥)*` : ''}`)
      .addFields(
        { name: '💼 Métier',        value: `${job.emoji} **${job.name}**`,                          inline: true },
        { name: `${symbol} Gagné`,  value: `**+${total.toLocaleString('fr-FR')}${symbol}**`,        inline: true },
        { name: '🔥 Streak',        value: `${workStreak} jour${workStreak > 1 ? 's' : ''}`,        inline: true },
      )
      .setFooter({ text: `Prochain travail disponible dans 1h • Solde: ${(user.balance + total).toLocaleString('fr-FR')}${symbol}` });

    await interaction.editReply({ embeds: [embed] }).catch(() => {});
  },

  async run(message, args) {
    const fakeInteraction = {
      user: message.author,
      guildId: message.guildId,
      deferred: false,
      replied: false,
      reply: async (d) => { const m = await message.channel.send(d).catch(() => {}); fakeInteraction._msg = m; return m; },
      editReply: async (d) => fakeInteraction._msg ? fakeInteraction._msg.edit(d).catch(() => {}) : message.channel.send(d).catch(() => {}),
      deferReply: async () => {},
      _msg: null,
    };
    await module.exports.execute(fakeInteraction);
  },
};
