const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rep')
    .setDescription('⭐ Gérer la réputation des membres')
    .addSubcommand(s => s
      .setName('donner')
      .setDescription('Donner de la réputation à un membre (une fois par jour)')
      .addUserOption(o => o.setName('membre').setDescription('Membre à récompenser').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Pourquoi ? (optionnel)').setRequired(false).setMaxLength(200))
    )
    .addSubcommand(s => s
      .setName('voir')
      .setDescription('Voir la réputation et les stats d\'un utilisateur')
      .addUserOption(o => o.setName('utilisateur').setDescription('Utilisateur à consulter (optionnel)').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('classement')
      .setDescription('🏆 Top 10 des utilisateurs les plus réputés du serveur')
    ),
  cooldown: 5,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'donner') {
      await handleDonner(interaction);
    } else if (subcommand === 'voir') {
      await handleVoir(interaction);
    } else if (subcommand === 'classement') {
      await handleClassement(interaction);
    }
  },

  async run(message, args) {
    const [subcommandArg] = args;
    const subcommand = subcommandArg?.toLowerCase() || 'voir';
    
    const fakeInteraction = {
      user: message.author,
      member: message.member,
      guild: message.guild,
      guildId: message.guildId,
      channel: message.channel,
      deferred: false,
      replied: false,
      options: {
        getSubcommand: () => subcommand,
        getUser: (key) => message.mentions.users.first() || message.author,
        getString: () => null,
      },
      async reply(opts) { return await message.channel.send(opts).catch(() => {}); },
      async editReply(opts) { return await message.channel.send(opts).catch(() => {}); },
      async deferReply() { this.deferred = true; },
    };
    await this.execute(fakeInteraction);
  },
};

async function handleDonner(interaction) {
  const target = interaction.options.getUser('membre');
  const message = interaction.options.getString('message') || null;
  const cfg = db.getConfig(interaction.guildId);

  if (target.bot) {
    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
      content: '❌ Les bots ne peuvent pas recevoir de réputation.',
      ephemeral: true
    });
  }

  if (target.id === interaction.user.id) {
    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
      content: '❌ Tu ne peux pas te donner de la réputation à toi-même.',
      ephemeral: true
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const lastRep = db.db.prepare(
    `SELECT * FROM rep_log
     WHERE guild_id = ? AND giver_id = ? AND receiver_id = ? AND created_at > ?`
  ).get(interaction.guildId, interaction.user.id, target.id, now - 86400);

  if (lastRep) {
    const nextAt = lastRep.created_at + 86400;
    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
      embeds: [new EmbedBuilder()
        .setColor('#FF6B6B')
        .setDescription(`❌ Tu as déjà donné une rep à **${target.username}** aujourd'hui. Prochain dans <t:${nextAt}:R>.`)
      ],
      ephemeral: true
    });
  }

  db.db.prepare(
    `INSERT INTO rep_log (guild_id, giver_id, receiver_id, message, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(interaction.guildId, interaction.user.id, target.id, message, now);

  db.db.prepare(
    `UPDATE users SET reputation = reputation + 1
     WHERE user_id = ? AND guild_id = ?`
  ).run(target.id, interaction.guildId);

  const newRep = db.getUser(target.id, interaction.guildId).reputation || 1;

  const milestones = { 10: 200, 25: 500, 50: 1000, 100: 2500, 500: 10000 };
  if (milestones[newRep]) {
    db.db.prepare(
      `UPDATE users SET balance = balance + ?
       WHERE user_id = ? AND guild_id = ?`
    ).run(milestones[newRep], target.id, interaction.guildId);
  }

  const newRank = await getUserRank(interaction.guildId, target.id);
  const embed = new EmbedBuilder()
    .setColor('#52B788')
    .setTitle('⭐ Réputation donnée !')
    .setDescription(`Tu as donné **+1 rep** à **${target.username}**!`)
    .addFields(
      { name: 'Nouvelle réputation', value: `**${newRep}** (rang: **#${newRank}**)`, inline: true },
      message ? { name: 'Message', value: `*"${message}"*`, inline: false } : { name: '​', value: '​', inline: false }
    )
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `${target.username}` })
    .setTimestamp();

  if (milestones[newRep]) {
    embed.setFooter({ text: `${target.username} a atteint une réputation de ${newRep} ! Bonus: +${milestones[newRep]} coins` });
  }

  return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
}

async function handleVoir(interaction) {
  const target = interaction.options.getUser('utilisateur') || interaction.user;

  const user = db.getUser(target.id, interaction.guildId) || {};
  const rank = await getUserRank(interaction.guildId, target.id);
  const total = db.db.prepare(`SELECT COUNT(*) as count FROM users WHERE guild_id = ? AND reputation > 0`).get(interaction.guildId).count;

  const embed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle(`⭐ Réputation de ${target.username}`)
    .setDescription(`**${user.reputation || 0}** réputation(s)`)
    .addFields(
      { name: 'Rang', value: `**#${rank}** sur ${total}`, inline: true },
      { name: 'Profil', value: `<@${target.id}>`, inline: true }
    )
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .setFooter({ text: interaction.guild.name })
    .setTimestamp();

  return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
}

async function handleClassement(interaction) {
  try {
    await interaction.deferReply();

    const topUsers = db.db.prepare(
      `SELECT u.user_id, u.reputation
       FROM users u
       WHERE u.guild_id = ? AND u.reputation > 0
       ORDER BY u.reputation DESC
       LIMIT 10`
    ).all(interaction.guildId);

    if (topUsers.length === 0) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription('❌ Aucune donnée de réputation sur ce serveur.')
        ]
      });
    }

    let description = '🏆 **Top 10 Réputation**\n\n';
    for (let i = 0; i < topUsers.length; i++) {
      const user = topUsers[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      const userMention = `<@${user.user_id}>`;
      description += `${medal} ${userMention} - **${user.reputation}** rep${user.reputation !== 1 ? 's' : ''}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('⭐ Classement des Réputations')
      .setDescription(description)
      .setThumbnail(interaction.guild.iconURL({ size: 256 }))
      .setFooter({ text: `Serveur: ${interaction.guild.name}` })
      .setTimestamp();

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  } catch (err) {
    console.error('[Rep classement] Erreur:', err);
    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
      content: '❌ Une erreur est survenue.',
      ephemeral: true
    });
  }
}

async function getUserRank(guildId, userId) {
  const result = db.db.prepare(
    `SELECT COUNT(*) as rank
     FROM users
     WHERE guild_id = ? AND reputation > (
       SELECT reputation FROM users WHERE user_id = ? AND guild_id = ?
     )`
  ).get(guildId, userId, guildId);

  return result.rank + 1;
}

async function getRankText(guildId, userId) {
  const rank = await getUserRank(guildId, userId);
  const total = db.db.prepare(
    `SELECT COUNT(*) as count FROM users WHERE guild_id = ? AND reputation > 0`
  ).get(guildId).count;

  return `**#${rank}** sur ${total}`;
}
