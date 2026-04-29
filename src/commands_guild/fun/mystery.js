// ============================================================
// /mystery — Boîtes mystères quotidiennes
// ============================================================
'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// ─── Init table ──────────────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS mystery_box (
    user_id   TEXT NOT NULL,
    guild_id  TEXT NOT NULL,
    last_open INTEGER DEFAULT 0,
    streak    INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    PRIMARY KEY(user_id, guild_id)
  )`).run();
} catch {}

// ─── Tirage pondéré ──────────────────────────────────────
// Taux : 50% basique, 30% petit, 15% gros, 4% énorme, 1% jackpot
const PRIZES = [
  { weight: 50, label: 'Pièce de chance',    emoji: '🪙', min: 100,    max: 1000,    color: '#95A5A6' },
  { weight: 30, label: 'Petite enveloppe',   emoji: '✉️', min: 1000,   max: 10000,   color: '#3498DB' },
  { weight: 15, label: 'Coffre brillant',    emoji: '💎', min: 10000,  max: 75000,   color: '#9B59B6' },
  { weight: 4,  label: 'Trésor légendaire',  emoji: '🏆', min: 75000,  max: 500000,  color: '#F1C40F' },
  { weight: 1,  label: 'JACKPOT MYSTÈRE',    emoji: '💰', min: 500000, max: 5000000, color: '#E74C3C' },
];
const TOTAL_W = PRIZES.reduce((s, p) => s + p.weight, 0);

function drawPrize() {
  let r = Math.random() * TOTAL_W, cum = 0;
  for (const p of PRIZES) {
    cum += p.weight;
    if (r < cum) {
      const amount = Math.floor(p.min + Math.random() * (p.max - p.min));
      return { ...p, amount };
    }
  }
  return { ...PRIZES[0], amount: 100 };
}

// ─── Cooldown ────────────────────────────────────────────
const COOLDOWN_HOURS = 6; // 4 boîtes / jour max

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mystery')
    .setDescription('🎁 Ouvre une boîte mystère (toutes les 6h)')
    .addSubcommand(s => s.setName('ouvrir').setDescription('🎁 Ouvre ta boîte mystère'))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Voir tes stats Mystery Box'))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Top 10 des plus gros gagnants Mystery')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const cfg = db.getConfig(guildId) || {};
    const coin = cfg.currency_emoji || '€';

    // Init la ligne
    db.db.prepare('INSERT OR IGNORE INTO mystery_box (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);

    if (sub === 'ouvrir') {
      const row = db.db.prepare('SELECT * FROM mystery_box WHERE user_id=? AND guild_id=?').get(userId, guildId);
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - (row.last_open || 0);
      const cooldownSec = COOLDOWN_HOURS * 3600;
      if (elapsed < cooldownSec) {
        const remain = cooldownSec - elapsed;
        const h = Math.floor(remain / 3600);
        const m = Math.floor((remain % 3600) / 60);
        return interaction.editReply({ content: `⏳ Prochaine boîte dans **${h}h${String(m).padStart(2, '0')}**. Reviens plus tard !` });
      }

      // Tirage
      const prize = drawPrize();
      const newStreak = (row.streak || 0) + 1;
      // Bonus streak +5% par jour consécutif (max +50%)
      const streakBonus = Math.min(0.5, newStreak * 0.05);
      const finalAmount = Math.floor(prize.amount * (1 + streakBonus));

      db.addCoins(userId, guildId, finalAmount, { type: 'mystery', note: 'Mystery Box' });
      db.db.prepare('UPDATE mystery_box SET last_open=?, streak=streak+1, total_opened=total_opened+1 WHERE user_id=? AND guild_id=?')
        .run(now, userId, guildId);

      const embed = new EmbedBuilder()
        .setColor(prize.color)
        .setTitle(`🎁 ${prize.label}`)
        .setDescription(`${prize.emoji} **${finalAmount.toLocaleString('fr-FR')} ${coin}** !${streakBonus > 0 ? `\n\n🔥 *Bonus streak ${newStreak}j : +${Math.round(streakBonus * 100)}%*` : ''}`)
        .setFooter({ text: `Prochaine boîte dans ${COOLDOWN_HOURS}h` })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'stats') {
      const row = db.db.prepare('SELECT * FROM mystery_box WHERE user_id=? AND guild_id=?').get(userId, guildId);
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('📊 Mes Mystery Box')
        .addFields(
          { name: '📦 Total ouvertes', value: `**${row?.total_opened || 0}**`, inline: true },
          { name: '🔥 Streak actuel',  value: `**${row?.streak || 0}** jours`, inline: true },
          { name: '⏳ Cooldown',        value: `**${COOLDOWN_HOURS}h** entre 2 boîtes`, inline: true },
        )
        .setFooter({ text: 'Plus ton streak est haut, plus tu gagnes !' });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'top') {
      const rows = db.db.prepare('SELECT user_id, total_opened FROM mystery_box WHERE guild_id=? ORDER BY total_opened DESC LIMIT 10').all(guildId);
      if (!rows.length) return interaction.editReply({ content: '🏆 Personne n\'a encore ouvert de Mystery Box.' });
      const lines = rows.map((r, i) => {
        const medal = ['🥇','🥈','🥉'][i] || `**${i+1}.**`;
        return `${medal} <@${r.user_id}> — **${r.total_opened}** boîtes`;
      }).join('\n');
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🏆 Top Mystery').setDescription(lines)
      ] });
    }
  },
};
