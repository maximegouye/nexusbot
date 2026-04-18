/**
 * /profil [membre] — Carte profil PREMIUM v2 avec boutons de sections.
 * (Remplace l'ancienne version simpliste.)
 */
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const ef = require('../../utils/embedFactory');

function buildMainEmbed(target, member, user, cfg, guild) {
  const symbol = cfg.currency_emoji || '€';

  const totalWealth = (user.balance || 0) + (user.bank || 0);
  const rank = db.db.prepare('SELECT COUNT(*) as r FROM users WHERE guild_id = ? AND (balance + bank) > ?').get(guild.id, totalWealth).r + 1;
  const totalUsers = db.db.prepare("SELECT COUNT(*) as c FROM users WHERE guild_id = ? AND (balance + bank + xp) > 0").get(guild.id).c;
  const xpRank = db.db.prepare('SELECT COUNT(*) as r FROM users WHERE guild_id = ? AND xp > ?').get(guild.id, user.xp || 0).r + 1;

  const curLevel = user.level || 1;
  const nextLevelXP = db.getXPForLevel ? db.getXPForLevel(curLevel + 1) : 0;
  const curLevelXP  = db.getXPForLevel ? db.getXPForLevel(curLevel)     : 0;
  const xpInLevel   = Math.max(0, (user.xp || 0) - curLevelXP);
  const xpNeeded    = Math.max(1, nextLevelXP - curLevelXP);
  const pct         = Math.min(1, xpInLevel / xpNeeded);
  const bar = ef.progressBar(xpInLevel, xpNeeded, 20);

  const voiceMin = user.voice_minutes || 0;
  const voiceH = Math.floor(voiceMin / 60);
  const voiceM = voiceMin % 60;

  let cryptoValue = 0;
  try {
    const wallet = db.getWallet(target.id, guild.id);
    const market = new Map((db.getCryptoMarket() || []).map(c => [c.symbol, c]));
    for (const w of wallet) { const m = market.get(w.crypto); if (m) cryptoValue += Math.floor(w.amount * m.price); }
  } catch {}

  const joinedAt = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
  const accountCreated = Math.floor(target.createdTimestamp / 1000);

  return ef.premium(`✨ Profil — ${target.username}`, [
    `🎭 **Pseudo :** ${member?.displayName || target.username}`,
    joinedAt ? `📅 **Arrivé :** <t:${joinedAt}:R>` : '',
    `🎂 **Compte créé :** <t:${accountCreated}:R>`,
    '',
    `⭐ **Niveau ${curLevel}** · \`${bar}\` ${Math.round(pct * 100)}%`,
    `✨ **${(user.xp || 0).toLocaleString('fr-FR')} XP** — Rang XP : **#${xpRank}**`,
  ].filter(Boolean), {
    thumbnail: target.displayAvatarURL({ size: 512 }),
    color: cfg.color || '#FFD700',
    fields: [
      { name: `👛 Liquide`,       value: `${(user.balance || 0).toLocaleString('fr-FR')}${symbol}`, inline: true },
      { name: `🏦 Banque`,         value: `${(user.bank || 0).toLocaleString('fr-FR')}${symbol}`,   inline: true },
      { name: `💹 Crypto`,         value: `${cryptoValue.toLocaleString('fr-FR')}${symbol}`,        inline: true },
      { name: `💎 Fortune totale`, value: `**${(totalWealth + cryptoValue).toLocaleString('fr-FR')}${symbol}**`, inline: true },
      { name: `🏆 Rang richesse`,  value: `**#${rank}** / ${totalUsers}`,                          inline: true },
      { name: `❤️ Réputation`,     value: `**${user.reputation || 0}**`,                           inline: true },
      { name: `💬 Messages`,       value: `${(user.message_count || 0).toLocaleString('fr-FR')}`,  inline: true },
      { name: `🎙️ Temps vocal`,    value: `**${voiceH}h ${voiceM}min**`,                           inline: true },
      { name: `🔥 Streak daily`,   value: `**${user.streak || 0}** jour(s)`,                       inline: true },
    ],
    footer: `NexusBot · ${guild.name}`,
  });
}

function buildButtons(userId, targetId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`profil_stats:${userId}:${targetId}`).setLabel('📊 Stats jeux').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`profil_crypto:${userId}:${targetId}`).setLabel('💹 Crypto').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`profil_badges:${userId}:${targetId}`).setLabel('🏅 Badges').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`profil_refresh:${userId}:${targetId}`).setLabel('🔄 Actualiser').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('✨ Carte profil premium')
    .addUserOption(o => o.setName('membre').setDescription('Membre à consulter').setRequired(false)),
  cooldown: 3,

  async execute(interaction) {
    const target = interaction.options.getUser('membre') || interaction.user;
    const member = interaction.guild.members.cache.get(target.id) || await interaction.guild.members.fetch(target.id).catch(() => null);
    const cfg = db.getConfig(interaction.guildId);
    const user = db.getUser(target.id, interaction.guildId);

    return interaction.reply({
      embeds: [buildMainEmbed(target, member, user, cfg, interaction.guild)],
      components: buildButtons(interaction.user.id, target.id),
    });
  },

  _build: { buildMainEmbed, buildButtons },
};
