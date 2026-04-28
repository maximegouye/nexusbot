/**
 * NexusBot — Système d'Achievements / Trophées
 * /achievements — Débloquez des trophées en accomplissant des exploits
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// Créer les tables nécessaires
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS achievements (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    guild_id   TEXT NOT NULL,
    key        TEXT NOT NULL,
    unlocked_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, guild_id, key)
  )`).run();
} catch {}

const ALL_ACHIEVEMENTS = [
  // ─── Messages ───────────────────────────────────────────────────────────
  { key: 'msg_1',     emoji: '💬', name: 'Premier message',     desc: 'Envoie ton 1er message',         condition: u => u.message_count >= 1,    reward: 50,   rarity: 'Commun' },
  { key: 'msg_100',   emoji: '📣', name: 'Bavard',              desc: '100 messages envoyés',           condition: u => u.message_count >= 100,  reward: 200,  rarity: 'Commun' },
  { key: 'msg_500',   emoji: '🗣️', name: 'Grand causeur',      desc: '500 messages envoyés',           condition: u => u.message_count >= 500,  reward: 500,  rarity: 'Rare' },
  { key: 'msg_1000',  emoji: '📢', name: 'Moulin à paroles',    desc: '1 000 messages envoyés',         condition: u => u.message_count >= 1000, reward: 1000, rarity: 'Rare' },
  { key: 'msg_5000',  emoji: '🏆', name: 'Légende du chat',     desc: '5 000 messages envoyés',         condition: u => u.message_count >= 5000, reward: 5000, rarity: 'Légendaire' },
  // ─── Niveaux ────────────────────────────────────────────────────────────
  { key: 'lvl_5',    emoji: '⭐', name: 'Apprenti',             desc: 'Atteins le niveau 5',            condition: u => u.level >= 5,   reward: 300,  rarity: 'Commun' },
  { key: 'lvl_10',   emoji: '🌟', name: 'Confirmé',             desc: 'Atteins le niveau 10',           condition: u => u.level >= 10,  reward: 600,  rarity: 'Commun' },
  { key: 'lvl_25',   emoji: '💫', name: 'Expert',               desc: 'Atteins le niveau 25',           condition: u => u.level >= 25,  reward: 2000, rarity: 'Rare' },
  { key: 'lvl_50',   emoji: '✨', name: 'Maître',               desc: 'Atteins le niveau 50',           condition: u => u.level >= 50,  reward: 5000, rarity: 'Épique' },
  { key: 'lvl_100',  emoji: '🌌', name: 'Légende',              desc: 'Atteins le niveau 100',          condition: u => u.level >= 100, reward: 15000,rarity: 'Légendaire' },
  // ─── Économie ────────────────────────────────────────────────────────────
  { key: 'eco_1k',   emoji: '💰', name: 'Premiers sous',        desc: 'Accumule 1 000 €',           condition: u => (u.balance+u.bank) >= 1000,   reward: 100,  rarity: 'Commun' },
  { key: 'eco_10k',  emoji: '💵', name: 'Petit épargnant',      desc: 'Accumule 10 000 €',          condition: u => (u.balance+u.bank) >= 10000,  reward: 500,  rarity: 'Commun' },
  { key: 'eco_100k', emoji: '💰', name: 'Riche',                desc: 'Accumule 100 000 €',         condition: u => (u.balance+u.bank) >= 100000, reward: 2000, rarity: 'Rare' },
  { key: 'eco_1m',   emoji: '💎', name: 'Millionnaire',         desc: 'Accumule 1 000 000 €',       condition: u => (u.balance+u.bank) >= 1000000,reward: 10000,rarity: 'Légendaire' },
  { key: 'earned_100k', emoji: '📈', name: 'Travailleur',       desc: 'Gagne 100 000 € au total',   condition: u => u.total_earned >= 100000,     reward: 3000, rarity: 'Rare' },
  // ─── Streaks ─────────────────────────────────────────────────────────────
  { key: 'streak_3', emoji: '🔥', name: 'En feu',               desc: 'Streak daily de 3 jours',        condition: u => u.streak >= 3,  reward: 200,  rarity: 'Commun' },
  { key: 'streak_7', emoji: '🔥', name: 'Une semaine',          desc: 'Streak daily de 7 jours',        condition: u => u.streak >= 7,  reward: 500,  rarity: 'Rare' },
  { key: 'streak_30',emoji: '🔥', name: 'Dévoué',               desc: 'Streak daily de 30 jours',       condition: u => u.streak >= 30, reward: 3000, rarity: 'Épique' },
  { key: 'streak_100',emoji:'🔥', name: 'Indestructible',       desc: 'Streak daily de 100 jours',      condition: u => u.streak >= 100,reward: 10000,rarity: 'Légendaire' },
  // ─── Vocal ───────────────────────────────────────────────────────────────
  { key: 'voice_1h', emoji: '🎤', name: 'Timide',               desc: '1 heure en vocal',               condition: u => u.voice_minutes >= 60,  reward: 200,  rarity: 'Commun' },
  { key: 'voice_10h',emoji: '🎙️', name: 'Sociable',            desc: '10 heures en vocal',              condition: u => u.voice_minutes >= 600, reward: 1000, rarity: 'Rare' },
  { key: 'voice_50h',emoji: '📻', name: 'Fan de vocal',         desc: '50 heures en vocal',             condition: u => u.voice_minutes >= 3000,reward: 5000, rarity: 'Épique' },
  // ─── Réputation ──────────────────────────────────────────────────────────
  { key: 'rep_10',  emoji: '👍', name: 'Apprécié',              desc: 'Obtiens 10 points de réputation',condition: u => u.reputation >= 10,  reward: 500,  rarity: 'Rare' },
  { key: 'rep_50',  emoji: '❤️', name: 'Star du serveur',       desc: 'Obtiens 50 points de réputation',condition: u => u.reputation >= 50,  reward: 3000, rarity: 'Épique' },
  { key: 'rep_100', emoji: '👑', name: 'Idole',                 desc: 'Obtiens 100 points de réputation',condition: u => u.reputation >= 100, reward: 8000, rarity: 'Légendaire' },
];

const RARITY_COLORS = {
  'Commun':      '#95a5a6',
  'Rare':        '#3498db',
  'Épique':      '#9b59b6',
  'Légendaire':  '#f39c12',
};

function getUnlocked(userId, guildId) {
  return db.db.prepare('SELECT key FROM achievements WHERE user_id=? AND guild_id=?').all(userId, guildId).map(r => r.key);
}

function unlock(userId, guildId, key) {
  try {
    db.db.prepare('INSERT OR IGNORE INTO achievements (user_id,guild_id,key) VALUES (?,?,?)').run(userId, guildId, key);
    return true;
  } catch { return false; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('🏆 Voir et débloquer tes trophées')
    .addSubcommand(s => s.setName('voir').setDescription('👁️ Voir tes trophées débloqués'))
    .addSubcommand(s => s.setName('tous').setDescription('📋 Voir tous les trophées disponibles'))
    .addSubcommand(s => s.setName('verifier').setDescription('🔄 Vérifier si tu as de nouveaux trophées'))
    .addSubcommand(s => s.setName('membre').setDescription('👤 Voir les trophées d\'un autre membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre à inspecter').setRequired(true))),
  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = sub === 'membre' ? interaction.options.getUser('membre').id : interaction.user.id;
    const targetUser = sub === 'membre' ? interaction.options.getUser('membre') : interaction.user;

    const user = db.getUser(userId, guildId);
    const unlocked = getUnlocked(userId, guildId);

    if (sub === 'voir' || sub === 'membre') {
      if (unlocked.length === 0) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95a5a6').setTitle('🏆 Aucun trophée').setDescription(`${sub === 'voir' ? 'Tu n\'as' : `**${targetUser.username}** n'a`} pas encore de trophée.\nUtilise \`/achievements vérifier\` pour vérifier !`)] });
      }
      const list = ALL_ACHIEVEMENTS.filter(a => unlocked.includes(a.key));
      const chunks = [];
      for (let i = 0; i < list.length; i += 10) chunks.push(list.slice(i, i + 10));
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle(`🏆 Trophées de ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(list.map(a => `${a.emoji} **${a.name}** — *${a.desc}*\n┗ \`${a.rarity}\` • +${a.reward} €`).join('\n\n'))
        .setFooter({ text: `${unlocked.length}/${ALL_ACHIEVEMENTS.length} trophées débloqués` });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'tous') {
      const rarities = ['Commun', 'Rare', 'Épique', 'Légendaire'];
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('📋 Tous les trophées disponibles')
        .setDescription(`Tu en as débloqué **${unlocked.length}/${ALL_ACHIEVEMENTS.length}**`);
      for (const r of rarities) {
        const list = ALL_ACHIEVEMENTS.filter(a => a.rarity === r);
        embed.addFields({
          name: `${r} (${list.filter(a => unlocked.includes(a.key)).length}/${list.length})`,
          value: list.map(a => `${unlocked.includes(a.key) ? '✅' : '🔒'} ${a.emoji} **${a.name}** — ${a.desc}`).join('\n'),
          inline: false,
        });
      }
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'verifier') {
      const newOnes = [];
      let totalReward = 0;
      for (const ach of ALL_ACHIEVEMENTS) {
        if (!unlocked.includes(ach.key) && ach.condition(user)) {
          if (unlock(userId, guildId, ach.key)) {
            newOnes.push(ach);
            totalReward += ach.reward;
          }
        }
      }
      if (newOnes.length > 0) {
        db.addCoins(userId, guildId, totalReward);
        const embed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setTitle(`🎉 ${newOnes.length} nouveau(x) trophée(s) débloqué(s) !`)
          .setDescription(newOnes.map(a => `${a.emoji} **${a.name}**\n┗ ${a.desc} • +${a.reward} €`).join('\n\n'))
          .setFooter({ text: `+${totalReward} € de récompense au total !` })
          .setTimestamp();
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
      }
      const embed = new EmbedBuilder()
        .setColor('#95a5a6')
        .setTitle('🏆 Vérification terminée')
        .setDescription(`Aucun nouveau trophée pour l'instant.\nTu en as **${unlocked.length}/${ALL_ACHIEVEMENTS.length}**.\nContinue tes activités pour en débloquer !`)
        .setFooter({ text: 'Reviens régulièrement !' });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }
  }
};
