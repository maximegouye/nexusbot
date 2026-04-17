/**
 * NexusBot — Battle Pass Saisonnier
 * /battlepass — 30 niveaux de défis avec récompenses progressives
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS battlepass (
    user_id     TEXT NOT NULL,
    guild_id    TEXT NOT NULL,
    season      INTEGER DEFAULT 1,
    xp_bp       INTEGER DEFAULT 0,
    level       INTEGER DEFAULT 1,
    claimed     TEXT DEFAULT '[]',
    PRIMARY KEY (user_id, guild_id, season)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS battlepass_config (
    guild_id    TEXT PRIMARY KEY,
    current_season INTEGER DEFAULT 1,
    season_name TEXT DEFAULT 'Saison 1',
    ends_at     INTEGER
  )`).run();
} catch {}

const SEASON_NAME = 'Saison 1 — L\'Aube';

// 30 niveaux de récompenses
const REWARDS = [
  { level: 1,  coins: 100,  xp: 0,   item: null,         emoji: '🎁', label: 'Débutant' },
  { level: 2,  coins: 150,  xp: 50,  item: null,         emoji: '💰', label: 'Curieux' },
  { level: 3,  coins: 200,  xp: 0,   item: null,         emoji: '⭐', label: 'Actif' },
  { level: 4,  coins: 250,  xp: 75,  item: null,         emoji: '💫', label: 'Régulier' },
  { level: 5,  coins: 500,  xp: 100, item: 'boost_xp',  emoji: '🔥', label: '★ Boost XP ×2 (1h)' },
  { level: 6,  coins: 300,  xp: 0,   item: null,         emoji: '💎', label: 'Engagé' },
  { level: 7,  coins: 350,  xp: 100, item: null,         emoji: '🌟', label: 'Passionné' },
  { level: 8,  coins: 400,  xp: 150, item: null,         emoji: '🎯', label: 'Précis' },
  { level: 9,  coins: 450,  xp: 0,   item: null,         emoji: '🏆', label: 'Élite' },
  { level: 10, coins: 1000, xp: 200, item: 'shield',    emoji: '🛡️', label: '★ MILESTONE — Bouclier' },
  { level: 11, coins: 500,  xp: 100, item: null,         emoji: '⚡', label: 'Rapide' },
  { level: 12, coins: 550,  xp: 150, item: null,         emoji: '🌈', label: 'Coloré' },
  { level: 13, coins: 600,  xp: 200, item: null,         emoji: '💫', label: 'Brillant' },
  { level: 14, coins: 650,  xp: 0,   item: null,         emoji: '🎖️', label: 'Médaillé' },
  { level: 15, coins: 2000, xp: 300, item: 'vip',       emoji: '👑', label: '★★ MILESTONE — VIP' },
  { level: 16, coins: 700,  xp: 150, item: null,         emoji: '🔮', label: 'Mystique' },
  { level: 17, coins: 750,  xp: 200, item: null,         emoji: '🌙', label: 'Nocturne' },
  { level: 18, coins: 800,  xp: 250, item: null,         emoji: '☀️', label: 'Solaire' },
  { level: 19, coins: 850,  xp: 300, item: null,         emoji: '🌠', label: 'Stellaire' },
  { level: 20, coins: 3000, xp: 500, item: 'mega_boost',emoji: '💥', label: '★★★ MILESTONE — Méga Boost' },
  { level: 21, coins: 1000, xp: 200, item: null,         emoji: '🎪', label: 'Entertaineur' },
  { level: 22, coins: 1100, xp: 250, item: null,         emoji: '🎨', label: 'Créatif' },
  { level: 23, coins: 1200, xp: 300, item: null,         emoji: '🎵', label: 'Musical' },
  { level: 24, coins: 1300, xp: 350, item: null,         emoji: '🏅', label: 'Honoré' },
  { level: 25, coins: 5000, xp: 500, item: 'legendary', emoji: '🌟', label: '★★★★ MILESTONE — Légendaire' },
  { level: 26, coins: 1500, xp: 300, item: null,         emoji: '⚔️', label: 'Guerrier' },
  { level: 27, coins: 1700, xp: 350, item: null,         emoji: '🛸', label: 'Explorateur' },
  { level: 28, coins: 1900, xp: 400, item: null,         emoji: '🔱', label: 'Majestueux' },
  { level: 29, coins: 2100, xp: 500, item: null,         emoji: '👁️', label: 'Omniscient' },
  { level: 30, coins: 10000,xp: 1000,item: 'champion',  emoji: '🏆', label: '★★★★★ MAX — CHAMPION ULTIME' },
];

const XP_PER_LEVEL = 500; // XP BP nécessaire par niveau

function getBP(userId, guildId, season = 1) {
  let bp = db.db.prepare('SELECT * FROM battlepass WHERE user_id=? AND guild_id=? AND season=?').get(userId, guildId, season);
  if (!bp) {
    db.db.prepare('INSERT OR IGNORE INTO battlepass (user_id, guild_id, season) VALUES (?,?,?)').run(userId, guildId, season);
    bp = db.db.prepare('SELECT * FROM battlepass WHERE user_id=? AND guild_id=? AND season=?').get(userId, guildId, season);
  }
  return bp;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battlepass')
    .setDescription('🎫 Battle Pass saisonnier — 30 niveaux de récompenses')
    .addSubcommand(s => s.setName('voir').setDescription('👁️ Voir ta progression'))
    .addSubcommand(s => s.setName('recompenses').setDescription('🎁 Voir toutes les récompenses'))
    .addSubcommand(s => s.setName('claim').setDescription('✅ Réclamer tes récompenses débloquées'))
    .addSubcommand(s => s.setName('xp').setDescription('📈 Gagner de l\'XP Battle Pass (activités)')
      .addStringOption(o => o.setName('activite').setDescription('Type d\'activité')
        .setRequired(true)
        .addChoices(
          { name: '💬 Message (50 XP)', value: 'message' },
          { name: '🎮 Mini-jeu joué (100 XP)', value: 'jeu' },
          { name: '🎤 1h en vocal (150 XP)', value: 'vocal' },
          { name: '📅 Daily réclamé (200 XP)', value: 'daily' },
        )))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Top 10 du Battle Pass'))
    .addSubcommand(s => s.setName('admin_reset')
      .setDescription('🔄 Reset le Battle Pass [Admin]')
      .addUserOption(o => o.setName('membre').setDescription('Membre à reset (vide = tout le serveur)'))),

  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;

    // Obtenir la saison actuelle
    let cfgSeason = db.db.prepare('SELECT current_season FROM battlepass_config WHERE guild_id=?').get(guildId);
    if (!cfgSeason) {
      db.db.prepare('INSERT OR IGNORE INTO battlepass_config (guild_id) VALUES (?)').run(guildId);
      cfgSeason = { current_season: 1 };
    }
    const season = cfgSeason.current_season;

    if (sub === 'voir') {
      const bp = getBP(userId, guildId, season);
      const claimed = JSON.parse(bp.claimed || '[]');
      const xpInLevel = bp.xp_bp % XP_PER_LEVEL;
      const progress = Math.round((xpInLevel / XP_PER_LEVEL) * 20);
      const bar = '█'.repeat(progress) + '░'.repeat(20 - progress);
      const nextReward = REWARDS.find(r => r.level > bp.level);

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`🎫 Battle Pass — ${SEASON_NAME}`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '🏆 Niveau',         value: `**${bp.level}** / 30`,                   inline: true },
          { name: '⭐ XP Battle Pass', value: `${bp.xp_bp.toLocaleString('fr-FR')}`,   inline: true },
          { name: '✅ Réclamés',        value: `${claimed.length} récompenses`,          inline: true },
          { name: '📊 Progression',    value: `\`${bar}\` **${xpInLevel}/${XP_PER_LEVEL} XP**`, inline: false },
        );

      if (nextReward) {
        embed.addFields({
          name: '🎁 Prochaine récompense',
          value: `Niveau **${nextReward.level}** — ${nextReward.emoji} ${nextReward.label}\n💰 ${nextReward.coins} coins ${nextReward.xp > 0 ? `• +${nextReward.xp} XP` : ''}`,
          inline: false,
        });
      } else {
        embed.addFields({ name: '🏆', value: '**Maximum atteint ! Tu es un CHAMPION !**', inline: false });
      }

      const unclaimed = REWARDS.filter(r => r.level <= bp.level && !claimed.includes(r.level));
      if (unclaimed.length > 0) {
        embed.addFields({ name: '📬 Récompenses à réclamer', value: `${unclaimed.length} récompense(s) — utilise \`/battlepass claim\``, inline: false });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'recompenses') {
      const bp = getBP(userId, guildId, season);
      const claimed = JSON.parse(bp.claimed || '[]');
      const chunks = [];
      for (let i = 0; i < 30; i += 10) chunks.push(REWARDS.slice(i, i + 10));
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle(`🎁 Récompenses — ${SEASON_NAME}`)
        .setDescription(`Ton niveau actuel : **${bp.level}/30**`);
      for (const chunk of chunks) {
        embed.addFields({
          name: `Niveaux ${chunk[0].level}–${chunk[chunk.length-1].level}`,
          value: chunk.map(r => {
            const status = claimed.includes(r.level) ? '✅' : bp.level >= r.level ? '📬' : '🔒';
            return `${status} **Niv.${r.level}** ${r.emoji} ${r.label} — ${r.coins}🪙${r.xp > 0 ? ` +${r.xp}XP` : ''}`;
          }).join('\n'),
          inline: false,
        });
      }
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'claim') {
      const bp = getBP(userId, guildId, season);
      const claimed = JSON.parse(bp.claimed || '[]');
      const unclaimed = REWARDS.filter(r => r.level <= bp.level && !claimed.includes(r.level));

      if (!unclaimed.length) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucune récompense à réclamer pour l\'instant. Continue à gagner de l\'XP !')] });
      }

      let totalCoins = 0, totalXP = 0;
      const newClaimed = [...claimed];
      for (const r of unclaimed) {
        totalCoins += r.coins;
        totalXP += r.xp;
        newClaimed.push(r.level);
      }

      db.db.prepare('UPDATE battlepass SET claimed=? WHERE user_id=? AND guild_id=? AND season=?')
        .run(JSON.stringify(newClaimed), userId, guildId, season);
      db.addCoins(userId, guildId, totalCoins);
      if (totalXP > 0) db.addXP(userId, guildId, totalXP);

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🎉 Récompenses réclamées !')
        .setDescription(unclaimed.map(r => `${r.emoji} **Niveau ${r.level}** — ${r.label} : +${r.coins}🪙${r.xp > 0 ? ` +${r.xp}XP` : ''}`).join('\n'))
        .setFooter({ text: `Total : +${totalCoins} 🪙${totalXP > 0 ? ` +${totalXP} XP` : ''}` });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'xp') {
      const activite = interaction.options.getString('activite');
      const xpMap = { message: 50, jeu: 100, vocal: 150, daily: 200 };
      const xpGain = xpMap[activite] || 50;
      const bp = getBP(userId, guildId, season);

      const newXP   = bp.xp_bp + xpGain;
      const newLevel = Math.min(30, Math.floor(newXP / XP_PER_LEVEL) + 1);
      const leveledUp = newLevel > bp.level;

      db.db.prepare('UPDATE battlepass SET xp_bp=?, level=? WHERE user_id=? AND guild_id=? AND season=?')
        .run(newXP, newLevel, userId, guildId, season);

      const embed = new EmbedBuilder()
        .setColor(leveledUp ? '#f39c12' : '#2ecc71')
        .setDescription(leveledUp
          ? `🎉 **LEVEL UP !** Tu es maintenant niveau **${newLevel}** !\n+${xpGain} XP Battle Pass — Utilise \`/battlepass claim\` pour tes récompenses !`
          : `✅ +**${xpGain} XP** Battle Pass !\nTotal : ${newXP} XP — Niveau **${newLevel}/30**`)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'classement') {
      const top = db.db.prepare('SELECT * FROM battlepass WHERE guild_id=? AND season=? ORDER BY xp_bp DESC LIMIT 10').all(guildId, season);
      if (!top.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucun joueur actif ce Battle Pass.')] });
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle(`🏆 Classement Battle Pass — ${SEASON_NAME}`)
        .setDescription(top.map((row, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return `${medal} <@${row.user_id}> — Niveau **${row.level}** (${row.xp_bp.toLocaleString('fr-FR')} XP)`;
        }).join('\n'));
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'admin_reset') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ content: '❌ Admin uniquement.' });
      }
      const target = interaction.options.getUser('membre');
      if (target) {
        db.db.prepare('DELETE FROM battlepass WHERE user_id=? AND guild_id=? AND season=?').run(target.id, guildId, season);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`✅ Battle Pass de **${target.username}** réinitialisé.`)] });
      }
      db.db.prepare('DELETE FROM battlepass WHERE guild_id=? AND season=?').run(guildId, season);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`✅ Battle Pass de tout le serveur réinitialisé pour la saison ${season}.`)] });
    }
  }
};
