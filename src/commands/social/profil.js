const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const BADGES_DEF = [
  { id: 'early_bird',   emoji: '🐦', name: 'Early Bird',     desc: 'Membre fondateur' },
  { id: 'rich',         emoji: '💰', name: 'Riche',          desc: 'Avoir 10 000 coins' },
  { id: 'social',       emoji: '⭐', name: 'Populaire',      desc: 'Avoir 50 reps' },
  { id: 'gambler',      emoji: '🎰', name: 'Joueur',         desc: 'Jouer au casino 100 fois' },
  { id: 'married',      emoji: '💍', name: 'Marié(e)',       desc: 'Être en couple sur Discord' },
  { id: 'hunter',       emoji: '🏹', name: 'Chasseur',       desc: 'Tuer 50 proies' },
  { id: 'veteran',      emoji: '🏅', name: 'Vétéran',        desc: 'Être présent depuis 30+ jours' },
  { id: 'lvl50',        emoji: '🔥', name: 'Niveau 50',      desc: 'Atteindre le niveau 50' },
  { id: 'lvl100',       emoji: '💎', name: 'Niveau 100',     desc: 'Atteindre le niveau 100' },
  { id: 'daily100',     emoji: '📅', name: 'Régulier',       desc: 'Streak de 100 jours' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('👤 Affiche le profil complet d\'un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(false)),
  cooldown: 5,

  async execute(interaction) {
    const target = interaction.options.getUser('membre') || interaction.user;
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(target.id, interaction.guildId);
    const emoji  = cfg.currency_emoji || '🪙';
    const name   = cfg.currency_name  || 'Coins';

    const member  = await interaction.guild.members.fetch(target.id).catch(() => null);
    const warns   = db.db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, target.id).c;
    const married = db.db.prepare('SELECT * FROM marriages WHERE (user1_id = ? OR user2_id = ?) AND guild_id = ?').get(target.id, target.id, interaction.guildId);

    // Calcul badges dynamiques
    const badges = [];
    const userBadges = JSON.parse(user.badges || '[]');

    // Badges automatiques
    if ((user.balance + user.bank) >= 10000) badges.push(BADGES_DEF.find(b => b.id === 'rich'));
    if ((user.reputation || 0) >= 50)       badges.push(BADGES_DEF.find(b => b.id === 'social'));
    if ((user.level || 1) >= 100)           badges.push(BADGES_DEF.find(b => b.id === 'lvl100'));
    else if ((user.level || 1) >= 50)       badges.push(BADGES_DEF.find(b => b.id === 'lvl50'));
    if ((user.streak || 0) >= 100)          badges.push(BADGES_DEF.find(b => b.id === 'daily100'));
    if (married)                            badges.push(BADGES_DEF.find(b => b.id === 'married'));
    for (const id of userBadges) {
      const b = BADGES_DEF.find(x => x.id === id);
      if (b && !badges.find(x => x.id === id)) badges.push(b);
    }

    // Rang dans le classement
    const xpRank     = db.db.prepare('SELECT COUNT(*) as r FROM users WHERE guild_id = ? AND xp > ?').get(interaction.guildId, user.xp || 0).r + 1;
    const coinsRank  = db.db.prepare('SELECT COUNT(*) as r FROM users WHERE guild_id = ? AND (balance+bank) > ?').get(interaction.guildId, (user.balance || 0) + (user.bank || 0)).r + 1;

    const joinedDaysAgo = member
      ? Math.floor((Date.now() - member.joinedTimestamp) / 86400000)
      : null;

    if (joinedDaysAgo !== null && joinedDaysAgo >= 30 && !badges.find(b => b.id === 'veteran')) {
      badges.push(BADGES_DEF.find(b => b.id === 'veteran'));
    }

    const embed = new EmbedBuilder()
      .setColor(member?.displayHexColor !== '#000000' ? member?.displayHexColor : cfg.color || '#7B2FBE')
      .setTitle(`👤 Profil de ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .setDescription(user.bio ? `*"${user.bio}"*` : '*Aucune bio définie — utilise `/setbio` pour en ajouter une !*')
      .addFields(
        // Stats
        { name: '⭐ Niveau',            value: `**${user.level || 1}** (#${xpRank} serveur)`,     inline: true },
        { name: `${emoji} Fortune`,     value: `**${((user.balance || 0) + (user.bank || 0)).toLocaleString('fr')}** ${name} (#${coinsRank})`, inline: true },
        { name: '⭐ Réputation',        value: `**${user.reputation || 0}** ⭐`,                  inline: true },
        // Activité
        { name: '💬 Messages',          value: `**${(user.message_count || 0).toLocaleString('fr')}**`, inline: true },
        { name: '🎤 Temps vocal',       value: `**${Math.floor((user.voice_minutes || 0) / 60)}h ${(user.voice_minutes || 0) % 60}min**`, inline: true },
        { name: '🔥 Streak',            value: `**${user.streak || 0}** jours`,                    inline: true },
        // Social
        ...(married ? [{ name: '💍 Marié(e) avec', value: `<@${married.user1_id === target.id ? married.user2_id : married.user1_id}>`, inline: true }] : []),
        ...(warns > 0 ? [{ name: '⚠️ Avertissements', value: `**${warns}**`, inline: true }] : []),
        ...(joinedDaysAgo !== null ? [{ name: '📅 Arrivée', value: `Il y a **${joinedDaysAgo}** jours`, inline: true }] : []),
        // Badges
        ...(badges.length > 0 ? [{ name: `🏅 Badges (${badges.length})`, value: badges.map(b => `${b.emoji} **${b.name}**`).join(' · '), inline: false }] : []),
      )
      .setFooter({ text: `NexusBot — Profil de ${target.tag || target.username}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
