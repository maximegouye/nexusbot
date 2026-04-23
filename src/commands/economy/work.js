const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

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
  { name: 'Streamer',       emoji: '🎮', min: 5,  max: 80 }, // variance élevée comme IRL
  { name: 'YouTubeur',      emoji: '📹', min: 3,  max: 90 },
  { name: 'Trader',         emoji: '📈', min: 2,  max: 120 }, // risque élevé
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('💼 Travaille pour gagner des euros (cooldown 1h)'),
  cooldown: 3,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const name   = cfg.currency_name  || 'Euros';

    const now      = Math.floor(Date.now() / 1000);
    const lastWork = user.last_work || 0;
    const cooldown = cfg.work_cooldown > 0 ? cfg.work_cooldown : 3600; // panel-configurable

    if (now - lastWork < cooldown) {
      const remaining = cooldown - (now - lastWork);
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('😴 Tu es fatigué !')
          .setDescription(`Repose-toi encore **${h > 0 ? h + 'h ' : ''}${m}min** avant de retravailler.`)
          .setFooter({ text: '💡 Utilise /daily et /crime pour gagner plus !' })
        ], ephemeral: true
      });
    }

    const job = JOBS[Math.floor(Math.random() * JOBS.length)];
    // Si des bornes globales sont configurées dans le panel, elles priment
    // sur les bornes par métier (permet de multiplier massivement les gains).
    const gMin = (cfg.work_min != null && cfg.work_min > 0) ? cfg.work_min : job.min;
    const gMax = (cfg.work_max != null && cfg.work_max > 0) ? cfg.work_max : job.max;
    const [lo, hi] = gMin <= gMax ? [gMin, gMax] : [gMax, gMin];
    const earned = Math.floor(Math.random() * (hi - lo + 1)) + lo;
    const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)].replace('{job}', job.name);

    // Bonus streak de travail (3 jours consécutifs = bonus)
    const lastWorkDate = lastWork > 0 ? new Date(lastWork * 1000).toDateString() : null;
    const yesterdayDate = new Date(Date.now() - 86400000).toDateString();
    const workStreak = (lastWorkDate === yesterdayDate) ? (user.work_streak || 0) + 1 : 1;
    const streakBonus = workStreak >= 3 ? Math.floor(earned * 0.15) : 0;
    const total = earned + streakBonus;

    db.addCoins(interaction.user.id, interaction.guildId, total);
    db.db.prepare('UPDATE users SET last_work = ?, work_streak = ? WHERE user_id = ? AND guild_id = ?')
      .run(now, workStreak, interaction.user.id, interaction.guildId);

    trackMission(interaction.user.id, interaction.guildId, 'work');
    trackMission(interaction.user.id, interaction.guildId, 'earn_coins', total);

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`${job.emoji} Tu as travaillé !`)
      .setDescription(`${phrase} **${total.toLocaleString('fr-FR')}${symbol}** ${streakBonus > 0 ? `(+${streakBonus}€ bonus streak 🔥)` : ''}`)
      .addFields(
        { name: '💼 Métier',        value: `${job.emoji} **${job.name}**`,         inline: true },
        { name: `${symbol} Gagné`,  value: `**+${total.toLocaleString('fr-FR')}${symbol}**`, inline: true },
        { name: '🔥 Streak',        value: `${workStreak} jour${workStreak > 1 ? 's' : ''}`, inline: true },
      )
      .setFooter({ text: `Prochain travail disponible dans 1h • Solde: ${(user.balance + total).toLocaleString('fr-FR')}${symbol}` });

    await interaction.editReply({ embeds: [embed] });
  }
};
