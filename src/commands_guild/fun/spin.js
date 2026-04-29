// ============================================================
// /spin — Roue de la fortune gratuite quotidienne
// ============================================================
'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS daily_spin (
    user_id   TEXT NOT NULL,
    guild_id  TEXT NOT NULL,
    last_spin INTEGER DEFAULT 0,
    streak    INTEGER DEFAULT 0,
    biggest_win INTEGER DEFAULT 0,
    PRIMARY KEY(user_id, guild_id)
  )`).run();
} catch {}

// 12 secteurs sur la roue : poids identique, gains très variables
const SECTORS = [
  { emoji: '💰',  label: 'JACKPOT',      amount: 1000000, color: '#E74C3C', weight: 1 },   // 1/100
  { emoji: '💎',  label: 'Méga gain',    amount: 250000,  color: '#9B59B6', weight: 2 },   // 2/100
  { emoji: '🏆',  label: 'Gros gain',    amount: 50000,   color: '#F1C40F', weight: 5 },   // 5/100
  { emoji: '💵',  label: 'Bon gain',     amount: 15000,   color: '#2ECC71', weight: 12 },  // 12/100
  { emoji: '💴',  label: 'Gain moyen',   amount: 5000,    color: '#3498DB', weight: 25 },  // 25/100
  { emoji: '🪙',  label: 'Petit gain',   amount: 1500,    color: '#95A5A6', weight: 30 },  // 30/100
  { emoji: '😅',  label: 'Mini gain',    amount: 500,     color: '#7F8C8D', weight: 25 },  // 25/100
];
const TOTAL_W = SECTORS.reduce((s, p) => s + p.weight, 0);

function drawSector() {
  let r = Math.random() * TOTAL_W, cum = 0;
  for (const s of SECTORS) {
    cum += s.weight;
    if (r < cum) return s;
  }
  return SECTORS[SECTORS.length - 1];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spin')
    .setDescription('🎡 Tourner la roue de la fortune (1× / 24h gratuit)')
    .addSubcommand(s => s.setName('tourner').setDescription('🎡 Tourner la roue'))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Voir tes stats spin')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const cfg = db.getConfig(guildId) || {};
    const coin = cfg.currency_emoji || '€';

    db.db.prepare('INSERT OR IGNORE INTO daily_spin (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);

    if (sub === 'tourner') {
      const row = db.db.prepare('SELECT * FROM daily_spin WHERE user_id=? AND guild_id=?').get(userId, guildId);
      const now = Math.floor(Date.now() / 1000);
      const cooldown = 24 * 3600;
      const elapsed = now - (row.last_spin || 0);
      if (elapsed < cooldown) {
        const remain = cooldown - elapsed;
        const h = Math.floor(remain / 3600);
        const m = Math.floor((remain % 3600) / 60);
        return interaction.editReply({ content: `⏳ Prochain spin dans **${h}h${String(m).padStart(2, '0')}**.` });
      }

      const sector = drawSector();
      // Bonus streak (jusqu'à +100% si streak 7+ jours)
      const newStreak = elapsed < 48 * 3600 ? (row.streak || 0) + 1 : 1;
      const streakBonus = Math.min(1, (newStreak - 1) * 0.15);
      const finalAmount = Math.floor(sector.amount * (1 + streakBonus));

      db.addCoins(userId, guildId, finalAmount, { type: 'daily_spin', note: 'Roue de la fortune' });
      const newBiggest = Math.max(row.biggest_win || 0, finalAmount);
      db.db.prepare('UPDATE daily_spin SET last_spin=?, streak=?, biggest_win=? WHERE user_id=? AND guild_id=?')
        .run(now, newStreak, newBiggest, userId, guildId);

      const embed = new EmbedBuilder()
        .setColor(sector.color)
        .setTitle(`🎡 La roue s'arrête sur... ${sector.emoji} ${sector.label}`)
        .setDescription(`Tu remportes **${finalAmount.toLocaleString('fr-FR')} ${coin}** !${streakBonus > 0 ? `\n\n🔥 *Streak ${newStreak}j : +${Math.round(streakBonus * 100)}%*` : ''}`)
        .setFooter({ text: 'Reviens demain pour tourner à nouveau !' })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'stats') {
      const row = db.db.prepare('SELECT * FROM daily_spin WHERE user_id=? AND guild_id=?').get(userId, guildId);
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#7B2FBE').setTitle('📊 Mes stats Roue')
          .addFields(
            { name: '🔥 Streak actuel',  value: `**${row?.streak || 0}** jours`, inline: true },
            { name: '💎 Plus gros gain', value: `**${(row?.biggest_win || 0).toLocaleString('fr-FR')} ${coin}**`, inline: true },
          )
      ] });
    }
  },
};
