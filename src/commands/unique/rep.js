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
  }
};

// ──── SUBCOMMAND: donner ────
async function handleDonner(interaction) {
  const target = interaction.options.getUser('membre');
  const message = interaction.options.getString('message') || null;
  const cfg = db.getConfig(interaction.guildId);

  if (target.bot) {
    return interaction.editReply({
      content: '❌ Les bots ne peuvent pas recevoir de réputation.',
      ephemeral: true
    });
  }

  if (target.id === interaction.user.id) {
    return interaction.editReply({
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
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor('#FF6B6B')
        .setDescription(`❌ Tu as déjà donné une rep à **${target.username}** aujourd'hui. Prochain dans <t:${nextAt}:R>.`)
      ],
      ephemeral: true
    });
  }

  // Insert rep log
  db.db.prepare(
    `INSERT INTO rep_log (guild_id, giver_id, receiver_id, message, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(interaction.guildId, interaction.user.id, target.id, message, now);

  // Update user reputation
  db.db.prepare(
    `UPDATE users SET reputation = reputation + 1
     WHERE user_id = ? AND guild_id = ?`
  ).run(target.id, interaction.guildId);

  const newRep = db.getUser(target.id, interaction.guildId).reputation || 1;

  // Milestone bonuses
  const milestones = { 10: 200, 25: 500, 50: 1000, 100: 2500, 500: 10000 };
  let bonusMsg = '';
  if (milestones[newRep]) {
    db.addCoins(target.id, interaction.guildId, milestones[newRep]);
    bonusMsg = `\n🎁 **Milestone ${newRep} rep !** +${milestones[newRep].toLocaleString('fr-FR')} ${cfg.currency_name || 'coins'} bonus !`;
  }

  const embed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('⭐ Réputation donnée !')
    .setDescription(`**${interaction.user.username}** a donné une ⭐ rep à **${target.username}** !${bonusMsg}`)
    .addFields(
      {
        name: '⭐ Réputation totale',
        value: `**${newRep}** ${newRep === 1 ? 'rep' : 'reps'}`,
        inline: true
      },
      {
        name: '👤 Rang du serveur',
        value: await getRankText(interaction.guildId, target.id),
        inline: true
      },
      ...(message ? [{ name: '💬 Message', value: message, inline: false }] : [])
    )
    .setThumbnail(target.displayAvatarURL({ size: 128 }))
    .setFooter({ text: `Donnée par ${interaction.user.username}` });

  await interaction.editReply({ embeds: [embed] });
}

// ──── SUBCOMMAND: voir ────
async function handleVoir(interaction) {
  const targetUser = interaction.options.getUser('utilisateur') || interaction.user;

  try {
    await interaction.deferReply();

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.editReply({
        content: '❌ Utilisateur non trouvé sur ce serveur.',
        ephemeral: true
      });
    }

    const user = db.getUser(targetUser.id, interaction.guildId);
    const reputation = user.reputation || 0;
    const rank = await getUserRank(interaction.guildId, targetUser.id);
    const givenCount = db.db.prepare(
      `SELECT COUNT(*) as count FROM rep_log
       WHERE guild_id = ? AND giver_id = ?`
    ).get(interaction.guildId, targetUser.id).count;
    const receivedCount = db.db.prepare(
      `SELECT COUNT(*) as count FROM rep_log
       WHERE guild_id = ? AND receiver_id = ?`
    ).get(interaction.guildId, targetUser.id).count;

    const embed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle(`⭐ Réputation de ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: '⭐ Réputation totale',
          value: `**${reputation}** rep${reputation !== 1 ? 's' : ''}`,
          inline: true
        },
        {
          name: '🏆 Classement',
          value: `**#${rank}** du serveur`,
          inline: true
        },
        {
          name: '📊 Stats détaillées',
          value: [
            `Reps données: **${givenCount}**`,
            `Reps reçues: **${receivedCount}**`,
            `Ratio: **${receivedCount > 0 ? (givenCount / receivedCount).toFixed(2) : givenCount > 0 ? '∞' : '0'}**`
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: targetUser.id });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Rep voir] Erreur:', err);
    await interaction.editReply({
      content: '❌ Une erreur est survenue.',
      ephemeral: true
    });
  }
}

// ──── SUBCOMMAND: classement ────
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
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription('❌ Aucune donnée de réputation sur ce serveur.')
        ]
      });
    }

    // Build leaderboard description
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

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Rep classement] Erreur:', err);
    await interaction.editReply({
      content: '❌ Une erreur est survenue.',
      ephemeral: true
    });
  }
}

// ──── HELPERS ────

/**
 * Get user's rank in server by reputation
 */
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

/**
 * Get user's rank text for inline display
 */
async function getRankText(guildId, userId) {
  const rank = await getUserRank(guildId, userId);
  const total = db.db.prepare(
    `SELECT COUNT(*) as count FROM users WHERE guild_id = ? AND reputation > 0`
  ).get(guildId).count;

  return `**#${rank}** sur ${total}`;
}
