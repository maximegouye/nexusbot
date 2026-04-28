// ============================================================
// recompenses.js — Système de récompenses par paliers
// /recompenses — voir et réclamer ses récompenses
// ============================================================
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

// ─── Initialisation de la table milestones ────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS user_milestones (
    user_id    TEXT NOT NULL,
    guild_id   TEXT NOT NULL,
    milestone  TEXT NOT NULL,
    claimed_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (user_id, guild_id, milestone)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS user_titles (
    user_id  TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    title    TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (user_id, guild_id)
  )`).run();
} catch {}

// ─── Définition des paliers ───────────────────────────────
const MILESTONES = [
  // ── Niveau ──────────────────────────────────────────────
  { id: 'lvl_5',    type: 'level',    threshold: 5,        coins: 500,    title: '⭐ Habitué',      label: 'Niveau 5',        emoji: '⭐' },
  { id: 'lvl_10',   type: 'level',    threshold: 10,       coins: 1500,   title: '🌟 Actif',        label: 'Niveau 10',       emoji: '🌟' },
  { id: 'lvl_15',   type: 'level',    threshold: 15,       coins: 2500,   xpBoost: 24,              label: 'Niveau 15',       emoji: '💫' },
  { id: 'lvl_20',   type: 'level',    threshold: 20,       coins: 4000,   title: '🏅 Vétéran',      label: 'Niveau 20',       emoji: '🏅' },
  { id: 'lvl_30',   type: 'level',    threshold: 30,       coins: 8000,   title: '🎖️ Élite',       label: 'Niveau 30',       emoji: '🎖️' },
  { id: 'lvl_40',   type: 'level',    threshold: 40,       coins: 15000,  title: '🏆 Champion',     label: 'Niveau 40',       emoji: '🏆' },
  { id: 'lvl_50',   type: 'level',    threshold: 50,       coins: 30000,  title: '💎 Légende',      label: 'Niveau 50',       emoji: '💎' },
  { id: 'lvl_75',   type: 'level',    threshold: 75,       coins: 75000,  title: '🔱 Immortel',     label: 'Niveau 75',       emoji: '🔱' },
  { id: 'lvl_100',  type: 'level',    threshold: 100,      coins: 200000, title: '🌌 Transcendant', label: 'Niveau 100',      emoji: '🌌' },

  // ── Gains totaux (total_earned) ──────────────────────────
  { id: 'earn_5k',   type: 'earned',  threshold: 5000,     coins: 500,                              label: '5 000€ gagnés',   emoji: '💰' },
  { id: 'earn_25k',  type: 'earned',  threshold: 25000,    coins: 1500,   title: '💰 Fortuné',      label: '25 000€ gagnés',  emoji: '💰' },
  { id: 'earn_100k', type: 'earned',  threshold: 100000,   coins: 5000,   title: '💵 Riche',        label: '100 000€ gagnés', emoji: '💵' },
  { id: 'earn_500k', type: 'earned',  threshold: 500000,   coins: 15000,  title: '👑 Millionnaire', label: '500 000€ gagnés', emoji: '👑' },
  { id: 'earn_1m',   type: 'earned',  threshold: 1000000,  coins: 50000,  title: '🤑 Tycoon',       label: '1 000 000€ gagnés',emoji:'🤑' },
  { id: 'earn_10m',  type: 'earned',  threshold: 10000000, coins: 200000, title: '🌟 Oligarque',    label: '10M€ gagnés',     emoji: '👁️' },

  // ── Streak quotidien ─────────────────────────────────────
  { id: 'streak_7',  type: 'streak',  threshold: 7,        coins: 1000,                             label: '7 jours /daily',  emoji: '🔥' },
  { id: 'streak_14', type: 'streak',  threshold: 14,       coins: 3000,   title: '🔥 Régulier',    label: '14 jours /daily', emoji: '🔥' },
  { id: 'streak_30', type: 'streak',  threshold: 30,       coins: 10000,  title: '⚡ Dédié',        label: '30 jours /daily', emoji: '⚡' },
  { id: 'streak_60', type: 'streak',  threshold: 60,       coins: 25000,  title: '🌊 Obsédé',      label: '60 jours /daily', emoji: '🌊' },
  { id: 'streak_100',type: 'streak',  threshold: 100,      coins: 75000,  title: '⚜️ Increvable',  label: '100 jours /daily',emoji: '⚜️' },

  // ── Messages envoyés ─────────────────────────────────────
  { id: 'msg_100',   type: 'messages',threshold: 100,      coins: 500,                              label: '100 messages',    emoji: '💬' },
  { id: 'msg_500',   type: 'messages',threshold: 500,      coins: 2000,   title: '🗣️ Bavard',     label: '500 messages',    emoji: '🗣️' },
  { id: 'msg_2500',  type: 'messages',threshold: 2500,     coins: 7500,   title: '📢 Orateur',     label: '2 500 messages',  emoji: '📢' },
  { id: 'msg_10000', type: 'messages',threshold: 10000,    coins: 30000,  title: '📣 Conférencier', label: '10 000 messages', emoji: '📣' },
];

// ─── Helpers ─────────────────────────────────────────────
function getUserValue(user, type) {
  if (type === 'level')    return user.level    || 1;
  if (type === 'earned')   return user.total_earned || 0;
  if (type === 'streak')   return user.streak   || 0;
  if (type === 'messages') return user.message_count || 0;
  return 0;
}

function isClaimed(userId, guildId, milestoneId) {
  return !!db.db.prepare('SELECT 1 FROM user_milestones WHERE user_id=? AND guild_id=? AND milestone=?').get(userId, guildId, milestoneId);
}

function getClaimableMilestones(user) {
  const userId = user.user_id;
  const guildId = user.guild_id;
  return MILESTONES.filter(m => {
    if (isClaimed(userId, guildId, m.id)) return false;
    return getUserValue(user, m.type) >= m.threshold;
  });
}

function formatCoins(n) {
  return n >= 1000000 ? `${(n/1000000).toFixed(1)}M€` : n >= 1000 ? `${(n/1000).toFixed(0)}k€` : `${n}€`;
}

function buildProgressBar(current, threshold, length = 10) {
  const ratio = Math.min(current / threshold, 1);
  const filled = Math.round(ratio * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

// ─── Catégories pour l'affichage ─────────────────────────
const CATEGORIES = [
  { key: 'level',    label: '⭐ Niveau',            icon: '⭐' },
  { key: 'earned',   label: '💰 Richesse totale',   icon: '💰' },
  { key: 'streak',   label: '🔥 Streak quotidien',  icon: '🔥' },
  { key: 'messages', label: '💬 Messages',           icon: '💬' },
];

function buildMainEmbed(user, cfg) {
  const coin = cfg.currency_emoji || '€';
  const claimable = getClaimableMilestones(user);

  const embed = new EmbedBuilder()
    .setColor(claimable.length > 0 ? '#F1C40F' : '#7B2FBE')
    .setTitle(`🎁 Récompenses — ${user.user_id ? `<@${user.user_id}>` : 'Paliers'}`)
    .setDescription(
      claimable.length > 0
        ? `✨ **Tu as ${claimable.length} récompense(s) à réclamer !** Clique sur **Réclamer** pour les obtenir.`
        : '📊 Continue à progresser pour débloquer de nouvelles récompenses !'
    )
    .setFooter({ text: `Niveau ${user.level} • ${(user.total_earned||0).toLocaleString('fr-FR')}€ gagnés • Streak ${user.streak}j • ${user.message_count} messages` });

  for (const cat of CATEGORIES) {
    const catMilestones = MILESTONES.filter(m => m.type === cat.key);
    const currentVal = getUserValue(user, cat.key);

    const lines = catMilestones.map(m => {
      const claimed = isClaimed(user.user_id, user.guild_id, m.id);
      const reached = currentVal >= m.threshold;
      const progress = buildProgressBar(currentVal, m.threshold, 8);

      let statusIcon = '🔒';
      if (claimed) statusIcon = '✅';
      else if (reached) statusIcon = '🟡';

      const rewardText = [
        `+${formatCoins(m.coins)}`,
        m.title ? `titre *${m.title}*` : '',
        m.xpBoost ? `XP×2 ${m.xpBoost}h` : '',
      ].filter(Boolean).join(' · ');

      if (claimed) {
        return `${statusIcon} ~~${m.label}~~ — *réclamée*`;
      } else if (reached) {
        return `${statusIcon} **${m.label}** — ${rewardText} ← **CLAIMABLE**`;
      } else {
        const pct = Math.floor((currentVal / m.threshold) * 100);
        return `${statusIcon} ${m.label} \`${progress}\` ${pct}%`;
      }
    });

    embed.addFields({ name: cat.label, value: lines.join('\n') || '—', inline: false });
  }

  return embed;
}

// ─── Module ───────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('recompenses')
    .setDescription('🎁 Voir et réclamer tes récompenses par paliers'),

  cooldown: 5,

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
      const userId  = interaction.user.id;
      const guildId = interaction.guildId;
      const cfg     = db.getConfig(guildId);
      const user    = db.getUser(userId, guildId);
      user.user_id  = userId;
      user.guild_id = guildId;

      const claimable = getClaimableMilestones(user);

      const embed = buildMainEmbed(user, cfg);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`reward_claim_${userId}`)
          .setLabel(claimable.length > 0 ? `✨ Réclamer (${claimable.length})` : '✅ Tout réclamé')
          .setStyle(claimable.length > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(claimable.length === 0),
        new ButtonBuilder()
          .setCustomId(`reward_title_${userId}`)
          .setLabel('🏷️ Mon titre actif')
          .setStyle(ButtonStyle.Primary),
      );

      return (interaction.deferred || interaction.replied ? interaction.editReply : interaction.reply)
        .bind(interaction)({ embeds: [embed], components: [row] });

    } catch (err) {
      console.error('[recompenses]', err?.message || err);
      const em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0, 200)}`, ephemeral: true };
      try {
        if (interaction.deferred || interaction.replied) await interaction.editReply(em).catch(() => {});
        else await interaction.reply(em).catch(() => {});
      } catch {}
    }
  },

  // ─── Handler des boutons ─────────────────────────────────
  async handleComponent(interaction) {
    try {
      const [, action, targetId] = interaction.customId.split('_');
      const userId  = interaction.user.id;
      const guildId = interaction.guildId;

      // Seul l'utilisateur qui a ouvert le menu peut interagir
      if (userId !== targetId) {
        return interaction.reply({ content: '❌ Ces récompenses ne sont pas les tiennes.', ephemeral: true });
      }

      const cfg  = db.getConfig(guildId);
      const coin = cfg.currency_emoji || '€';

      if (action === 'claim') {
        const user    = db.getUser(userId, guildId);
        user.user_id  = userId;
        user.guild_id = guildId;

        const claimable = getClaimableMilestones(user);

        if (claimable.length === 0) {
          return interaction.reply({ content: '✅ Tu n\'as aucune récompense à réclamer pour l\'instant.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true }).catch(() => {});

        let totalCoins = 0;
        const rewards = [];
        let lastTitle = null;

        for (const m of claimable) {
          // Marquer comme réclamé
          db.db.prepare(`INSERT OR IGNORE INTO user_milestones (user_id, guild_id, milestone) VALUES (?,?,?)`)
            .run(userId, guildId, m.id);

          // Donner les coins
          totalCoins += m.coins;

          // Appliquer le titre si présent
          if (m.title) {
            db.db.prepare(`INSERT OR REPLACE INTO user_titles (user_id, guild_id, title) VALUES (?,?,?)`)
              .run(userId, guildId, m.title);
            lastTitle = m.title;
          }

          // XP Boost si présent
          if (m.xpBoost) {
            const expiresAt = Math.floor(Date.now() / 1000) + m.xpBoost * 3600;
            // Stocker le boost dans guild_kv
            try {
              db.db.prepare(`INSERT OR REPLACE INTO guild_kv (guild_id, key, value) VALUES (?,?,?)`)
                .run(guildId, `xpboost_${userId}`, String(expiresAt));
            } catch {}
          }

          rewards.push(`${m.emoji} **${m.label}** → +${formatCoins(m.coins)}${m.title ? ` + titre *${m.title}*` : ''}${m.xpBoost ? ` + XP×2 ${m.xpBoost}h` : ''}`);
        }

        // Donner les coins d'un coup
        db.addCoins(userId, guildId, totalCoins);

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🎉 Récompenses réclamées !')
          .setDescription(rewards.join('\n'))
          .addFields({
            name: '💰 Total reçu',
            value: `**+${totalCoins.toLocaleString('fr-FR')} ${coin}**`,
            inline: true,
          })
          .setFooter({ text: lastTitle ? `Titre actif : ${lastTitle}` : 'Continue à progresser !' });

        return (interaction.deferred || interaction.replied ? interaction.editReply : interaction.reply)
          .bind(interaction)({ embeds: [embed] });
      }

      if (action === 'title') {
        const titleRow = db.db.prepare('SELECT title FROM user_titles WHERE user_id=? AND guild_id=?').get(userId, guildId);
        const title = titleRow?.title || null;

        if (!title) {
          return interaction.reply({
            content: '🏷️ Tu n\'as encore aucun titre. Atteins des paliers pour en débloquer !',
            ephemeral: true
          });
        }

        // Lister tous les titres débloqués
        const claimed = db.db.prepare('SELECT milestone FROM user_milestones WHERE user_id=? AND guild_id=?').all(userId, guildId);
        const claimedIds = new Set(claimed.map(r => r.milestone));
        const unlockedTitles = MILESTONES.filter(m => m.title && claimedIds.has(m.id)).map(m => m.title);

        const embed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('🏷️ Tes titres débloqués')
          .setDescription(
            unlockedTitles.length > 0
              ? unlockedTitles.map((t, i) => `${t === title ? '▶️' : '◽'} ${t}`).join('\n')
              : 'Aucun titre débloqué.'
          )
          .setFooter({ text: `Titre actif : ${title}` });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } catch (err) {
      console.error('[reward component]', err?.message || err);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Erreur lors du traitement.', ephemeral: true }).catch(() => {});
        }
      } catch {}
    }
  },
};

// ─── Exports utilitaires pour d'autres modules ────────────
module.exports.checkMilestones = function(userId, guildId) {
  try {
    const user    = db.getUser(userId, guildId);
    user.user_id  = userId;
    user.guild_id = guildId;
    return getClaimableMilestones(user).length > 0;
  } catch { return false; }
};

module.exports.getUserTitle = function(userId, guildId) {
  try {
    const row = db.db.prepare('SELECT title FROM user_titles WHERE user_id=? AND guild_id=?').get(userId, guildId);
    return row?.title || null;
  } catch { return null; }
};
