/**
 * NexusBot — Statistiques Membres Avancées
 * /stats — Statistiques détaillées d'un membre ou du serveur
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('📊 Statistiques détaillées')
    .addSubcommand(s => s.setName('membre')
      .setDescription('👤 Stats complètes d\'un membre')
      .addUserOption(o => o.setName('utilisateur').setDescription('Membre (vous-même si vide)')))
    .addSubcommand(s => s.setName('serveur').setDescription('🏠 Statistiques globales du serveur'))
    .addSubcommand(s => s.setName('activite').setDescription('📈 Activité récente du serveur')),

  cooldown: 10,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'membre') {
      const target = interaction.options.getUser('utilisateur') || interaction.user;
      const member = interaction.guild.members.cache.get(target.id);
      const user   = db.getUser(target.id, guildId);

      // XP & level
      const xpForNext = (user.level + 1) * 100;
      const xpPct     = Math.round((user.xp / xpForNext) * 100);
      const xpBar     = '█'.repeat(Math.floor(xpPct/10)) + '░'.repeat(10-Math.floor(xpPct/10));

      // Economie
      const lbRank = db.getLeaderboard(guildId, 'coins', 100).findIndex(u => u.user_id === target.id) + 1;
      const xpRank = db.getLeaderboard(guildId, 'xp', 100).findIndex(u => u.user_id === target.id) + 1;

      // Jours sur le serveur
      const joinedAt = member?.joinedAt;
      const daysOnServer = joinedAt ? Math.floor((Date.now() - joinedAt.getTime()) / 86400000) : '?';

      // Mood (if any)
      const lastMood = db.db.prepare('SELECT * FROM mood_logs WHERE user_id=? AND guild_id=? ORDER BY logged_at DESC LIMIT 1').get(target.id, guildId);
      const MOODS = ['','😭','😢','😐','🙂','😄','🤩'];

      // Achievements count
      let achCount = 0;
      try { achCount = db.db.prepare('SELECT COUNT(*) as c FROM achievements WHERE user_id=? AND guild_id=?').get(target.id, guildId)?.c || 0; } catch {}

      // Check-in streak
      let checkinStreak = 0;
      try { const ci = db.db.prepare('SELECT streak FROM checkin_log WHERE user_id=? AND guild_id=? ORDER BY checked_at DESC LIMIT 1').get(target.id, guildId); checkinStreak = ci?.streak || 0; } catch {}

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`📊 Stats — ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: '⭐ Niveau',         value: `**${user.level}** (${user.xp}/${xpForNext} XP)\n\`${xpBar}\` ${xpPct}%`, inline: false },
          { name: '💶 €',          value: `**${(user.balance + user.bank).toLocaleString()}** € (#${lbRank || '?'} serveur)`,  inline: true },
          { name: '🏆 Rang XP',        value: `#${xpRank || '?'} sur le serveur`,                                    inline: true },
          { name: '🔥 Streak check-in', value: `${checkinStreak} jour(s)`,                                            inline: true },
          { name: '🎖️ Succès',         value: `${achCount} débloqué(s)`,                                             inline: true },
          { name: '📅 Sur le serveur',  value: `${daysOnServer} jour(s)`,                                            inline: true },
        );

      if (lastMood) {
        embed.addFields({ name: '🌡️ Dernière humeur', value: `${MOODS[lastMood.mood]} (${new Date(lastMood.logged_at*1000).toLocaleDateString('fr-FR')})`, inline: true });
      }

      if (member?.roles.cache.size > 1) {
        const roles = member.roles.cache.filter(r => r.id !== guildId).sort((a,b) => b.position-a.position).first(5);
        embed.addFields({ name: '🏷️ Rôles principaux', value: roles.map(r => `<@&${r.id}>`).join(' '), inline: false });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'serveur') {
      const guild  = interaction.guild;
      const members = guild.memberCount;
      const bots   = guild.members.cache.filter(m => m.user.bot).size;
      const humans = members - bots;
      const online = guild.members.cache.filter(m => m.presence?.status === 'online').size;

      const totalCoins = db.db.prepare('SELECT SUM(balance) as t FROM users WHERE guild_id=?').get(guildId)?.t || 0;
      const totalXP    = db.db.prepare('SELECT SUM(xp) as t FROM users WHERE guild_id=?').get(guildId)?.t || 0;
      const userCount  = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=?').get(guildId)?.c || 0;

      const channels  = guild.channels.cache;
      const textCh    = channels.filter(c => c.type === 0).size;
      const voiceCh   = channels.filter(c => c.type === 2).size;
      const categories = channels.filter(c => c.type === 4).size;

      const boosts    = guild.premiumSubscriptionCount || 0;
      const boostTier = guild.premiumTier || 0;

      const createdAt = guild.createdAt;
      const ageDays   = Math.floor((Date.now() - createdAt.getTime()) / 86400000);

      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle(`🏠 Stats — ${guild.name}`)
        .setThumbnail(guild.iconURL({ size: 256 }) || '')
        .addFields(
          { name: '👥 Membres',      value: `${humans} humains\n${bots} bots\n${online} en ligne`,         inline: true },
          { name: '💬 Salons',       value: `${textCh} texte\n${voiceCh} vocal\n${categories} catégories`, inline: true },
          { name: '⚡ Boosts',       value: `${boosts} boosts (Tier ${boostTier})`,                        inline: true },
          { name: '💶 € total',  value: `${totalCoins.toLocaleString()}`,                              inline: true },
          { name: '⭐ XP total',     value: `${totalXP.toLocaleString()}`,                                 inline: true },
          { name: '👤 Utilisateurs', value: `${userCount} enregistrés`,                                    inline: true },
          { name: '📅 Créé le',      value: `${createdAt.toLocaleDateString('fr-FR')} (${ageDays} jours)`, inline: false },
        );

      // Top 3 coins
      const top3 = db.getLeaderboard(guildId, 'coins', 3);
      if (top3.length) {
        embed.addFields({ name: '🏆 Top 3 Coins', value: top3.map((u,i) => `${['🥇','🥈','🥉'][i]} <@${u.user_id}> — ${(u.balance + u.bank).toLocaleString()} €`).join('\n'), inline: false });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'activite') {
      const guild = interaction.guild;
      const now   = Math.floor(Date.now() / 1000);
      const day   = now - 86400;
      const week  = now - 604800;

      // Messages today (approximation via mood logs as activity indicator)
      let activeLast24h = 0, activeLast7d = 0;
      try {
        activeLast24h = db.db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM mood_logs WHERE guild_id=? AND logged_at>=?').get(guildId, day)?.c || 0;
        activeLast7d  = db.db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM mood_logs WHERE guild_id=? AND logged_at>=?').get(guildId, week)?.c || 0;
      } catch {}

      let newMembers = 0;
      try { newMembers = guild.members.cache.filter(m => m.joinedTimestamp && m.joinedTimestamp > day * 1000).size; } catch {}

      let checkinToday = 0;
      try { checkinToday = db.db.prepare('SELECT COUNT(*) as c FROM checkin_log WHERE guild_id=? AND checked_at>=?').get(guildId, day)?.c || 0; } catch {}

      let parisOpen = 0;
      try { parisOpen = db.db.prepare("SELECT COUNT(*) as c FROM paris WHERE guild_id=? AND status='open'").get(guildId)?.c || 0; } catch {}

      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`📈 Activité Récente — ${guild.name}`)
        .addFields(
          { name: '🆕 Nouveaux membres (24h)', value: `${newMembers}`,     inline: true },
          { name: '✅ Check-ins aujourd\'hui', value: `${checkinToday}`,   inline: true },
          { name: '🎲 Paris ouverts',          value: `${parisOpen}`,      inline: true },
          { name: '🌍 Humeurs enregistrées (7j)', value: `${activeLast7d}`, inline: true },
        )
        .setFooter({ text: `Serveur : ${guild.name} • ${guild.memberCount} membres` });

      return interaction.editReply({ embeds: [embed] });
    }
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
