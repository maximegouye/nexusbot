/**
 * NexusBot — Commandes Administrateur Économie
 * /econ-admin : donner/retirer/reset/voir l'argent des membres
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('econ-admin')
    .setDescription('⚙️ Gestion de l\'économie (Administrateurs)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s
      .setName('donner')
      .setDescription('💸 Donner des euros à un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant en €').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('raison').setDescription('Raison (optionnel)').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('retirer')
      .setDescription('💰 Retirer des euros à un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant en €').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('raison').setDescription('Raison (optionnel)').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('reset')
      .setDescription('🔄 Remettre à zéro le compte d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('reset-all')
      .setDescription('⚠️ Remettre à zéro TOUTE l\'économie du serveur')
    )
    .addSubcommand(s => s
      .setName('voir')
      .setDescription('🔍 Voir le compte d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('definir')
      .setDescription('✏️ Définir exactement le solde d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Nouveau solde').setRequired(true).setMinValue(0))
    )
    .addSubcommand(s => s
      .setName('config')
      .setDescription('⚙️ Configurer la monnaie du serveur')
      .addStringOption(o => o.setName('nom').setDescription('Nom de la monnaie (ex: Euros)').setRequired(false))
      .addStringOption(o => o.setName('symbole').setDescription('Symbole (ex: €, 💶)').setRequired(false))
      .addIntegerOption(o => o.setName('daily').setDescription('Récompense daily de base').setRequired(false).setMinValue(1))
      .addIntegerOption(o => o.setName('par-message').setDescription('Coins par message (0 pour désactiver)').setRequired(false).setMinValue(0))
    )
    .addSubcommand(s => s
      .setName('donner-role')
      .setDescription('👥 Donner des euros à tous les membres d\'un rôle')
      .addRoleOption(o => o.setName('role').setDescription('Rôle cible').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant par membre').setRequired(true).setMinValue(1))
    )
    .addSubcommand(s => s
      .setName('stats')
      .setDescription('📊 Statistiques de l\'économie du serveur')
    ),
  cooldown: 3,

  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const cfg    = db.getConfig(interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const name   = cfg.currency_name  || 'Euros';

    if (sub === 'donner') {
      const target  = interaction.options.getUser('membre');
      const amount  = interaction.options.getInteger('montant');
      const raison  = interaction.options.getString('raison') || 'Don admin';

      db.addCoins(target.id, interaction.guildId, amount);
      const newUser = db.getUser(target.id, interaction.guildId);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('💸 Don effectué')
          .addFields(
            { name: '👤 Membre',        value: `<@${target.id}>`,                            inline: true },
            { name: '💰 Montant donné', value: `**+${amount.toLocaleString('fr-FR')}${symbol}**`, inline: true },
            { name: '💎 Nouveau solde', value: `**${newUser.balance.toLocaleString('fr-FR')}${symbol}**`, inline: true },
            { name: '📝 Raison',        value: raison,                                        inline: false },
          )
          .setFooter({ text: `Effectué par ${interaction.user.tag}` })
          .setTimestamp()
        ], ephemeral: true
      });
    }

    if (sub === 'retirer') {
      const target  = interaction.options.getUser('membre');
      const amount  = interaction.options.getInteger('montant');
      const raison  = interaction.options.getString('raison') || 'Retrait admin';

      const userBefore = db.getUser(target.id, interaction.guildId);
      const actualRemoved = Math.min(amount, userBefore.balance);
      db.removeCoins(target.id, interaction.guildId, amount);
      const newUser = db.getUser(target.id, interaction.guildId);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E67E22')
          .setTitle('💰 Retrait effectué')
          .addFields(
            { name: '👤 Membre',        value: `<@${target.id}>`,                               inline: true },
            { name: '💸 Retiré',        value: `**-${actualRemoved.toLocaleString('fr-FR')}${symbol}**`, inline: true },
            { name: '💎 Nouveau solde', value: `**${newUser.balance.toLocaleString('fr-FR')}${symbol}**`, inline: true },
            { name: '📝 Raison',        value: raison,                                           inline: false },
          )
          .setFooter({ text: `Effectué par ${interaction.user.tag}` })
          .setTimestamp()
        ], ephemeral: true
      });
    }

    if (sub === 'reset') {
      const target = interaction.options.getUser('membre');
      db.db.prepare('UPDATE users SET balance=0, bank=0, total_earned=0 WHERE user_id=? AND guild_id=?')
        .run(target.id, interaction.guildId);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🔄 Compte remis à zéro')
          .setDescription(`Le compte de <@${target.id}> a été remis à **0${symbol}**.`)
          .setFooter({ text: `Effectué par ${interaction.user.tag}` })
        ], ephemeral: true
      });
    }

    if (sub === 'reset-all') {
      db.db.prepare('UPDATE users SET balance=0, bank=0, total_earned=0 WHERE guild_id=?').run(interaction.guildId);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('⚠️ Économie complète remise à zéro')
          .setDescription('Tous les comptes du serveur ont été remis à **0€**.')
          .setFooter({ text: `Effectué par ${interaction.user.tag}` })
        ], ephemeral: true
      });
    }

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre');
      const u = db.getUser(target.id, interaction.guildId);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(cfg.color || '#7B2FBE')
          .setTitle(`🔍 Compte de ${target.username}`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: '👛 Portefeuille', value: `**${u.balance.toLocaleString('fr-FR')}${symbol}**`, inline: true },
            { name: '🏦 Banque',       value: `**${u.bank.toLocaleString('fr-FR')}${symbol}**`,    inline: true },
            { name: '💎 Total gagné',  value: `**${u.total_earned.toLocaleString('fr-FR')}${symbol}**`, inline: true },
          )
        ], ephemeral: true
      });
    }

    if (sub === 'definir') {
      const target = interaction.options.getUser('membre');
      const amount = interaction.options.getInteger('montant');
      db.db.prepare('UPDATE users SET balance=? WHERE user_id=? AND guild_id=?').run(amount, target.id, interaction.guildId);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('✏️ Solde défini')
          .setDescription(`Le solde de <@${target.id}> est maintenant **${amount.toLocaleString('fr-FR')}${symbol}**.`)
          .setFooter({ text: `Effectué par ${interaction.user.tag}` })
        ], ephemeral: true
      });
    }

    if (sub === 'config') {
      const nom    = interaction.options.getString('nom');
      const sym    = interaction.options.getString('symbole');
      const daily  = interaction.options.getInteger('daily');
      const perMsg = interaction.options.getInteger('par-message');

      if (nom)    db.setConfig(interaction.guildId, 'currency_name',  nom);
      if (sym)    db.setConfig(interaction.guildId, 'currency_emoji', sym);
      if (daily !== null)  db.setConfig(interaction.guildId, 'daily_amount', daily);
      if (perMsg !== null) db.setConfig(interaction.guildId, 'coins_per_msg', perMsg);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('⚙️ Économie configurée')
          .addFields(
            ...(nom    ? [{ name: '🏷️ Nom',           value: nom,        inline: true }] : []),
            ...(sym    ? [{ name: '💱 Symbole',        value: sym,        inline: true }] : []),
            ...(daily  ? [{ name: '📅 Daily base',     value: `${daily}`, inline: true }] : []),
            ...(perMsg !== null ? [{ name: '💬 Par message', value: `${perMsg}`, inline: true }] : []),
          )
          .setDescription('Configuration mise à jour avec succès !')
          .setFooter({ text: `Par ${interaction.user.tag}` })
        ], ephemeral: true
      });
    }

    if (sub === 'donner-role') {
      const role   = interaction.options.getRole('role');
      const amount = interaction.options.getInteger('montant');

      await interaction.guild.members.fetch();
      const members = interaction.guild.members.cache.filter(m => m.roles.cache.has(role.id) && !m.user.bot);
      let count = 0;
      for (const [, member] of members) {
        db.addCoins(member.id, interaction.guildId, amount);
        count++;
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('👥 Don de masse effectué')
          .addFields(
            { name: '👥 Rôle',          value: `<@&${role.id}>`,                              inline: true },
            { name: '👤 Membres',       value: `**${count}**`,                                inline: true },
            { name: '💰 Par membre',    value: `**+${amount.toLocaleString('fr-FR')}${symbol}**`, inline: true },
            { name: '💸 Total distribué', value: `**${(count * amount).toLocaleString('fr-FR')}${symbol}**`, inline: true },
          )
          .setFooter({ text: `Effectué par ${interaction.user.tag}` })
          .setTimestamp()
        ], ephemeral: true
      });
    }

    if (sub === 'stats') {
      const totalUsers  = db.db.prepare("SELECT COUNT(*) as c FROM users WHERE guild_id=?").get(interaction.guildId).c;
      const totalMoney  = db.db.prepare("SELECT SUM(balance + bank) as s FROM users WHERE guild_id=?").get(interaction.guildId).s || 0;
      const richest     = db.db.prepare("SELECT user_id, balance+bank as total FROM users WHERE guild_id=? ORDER BY total DESC LIMIT 1").get(interaction.guildId);
      const avgBalance  = totalUsers > 0 ? Math.round(totalMoney / totalUsers) : 0;
      const broke       = db.db.prepare("SELECT COUNT(*) as c FROM users WHERE guild_id=? AND balance+bank=0").get(interaction.guildId).c;

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(cfg.color || '#7B2FBE')
          .setTitle('📊 Économie du serveur')
          .addFields(
            { name: '👤 Membres',        value: `**${totalUsers}**`,                              inline: true },
            { name: '💰 En circulation', value: `**${totalMoney.toLocaleString('fr-FR')}${symbol}**`, inline: true },
            { name: '📊 Moyenne',        value: `**${avgBalance.toLocaleString('fr-FR')}${symbol}**`, inline: true },
            { name: '💸 À sec',          value: `**${broke}** membre(s)`,                          inline: true },
            { name: '🏆 Plus riche',     value: richest ? `<@${richest.user_id}> — ${richest.total.toLocaleString('fr-FR')}${symbol}` : 'N/A', inline: false },
          )
          .setTimestamp()
        ], ephemeral: true
      });
    }
  }
};
