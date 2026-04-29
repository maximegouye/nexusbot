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
      .addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('raison').setDescription('Raison (optionnel)').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('retirer')
      .setDescription('💰 Retirer des euros à un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(1))
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
      .addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(0))
    )
    .addSubcommand(s => s
      .setName('config')
      .setDescription('⚙️ Configurer la monnaie du serveur')
      .addStringOption(o => o.setName('nom').setDescription('Nom de la monnaie (ex: Euros)').setRequired(false))
      .addStringOption(o => o.setName('symbole').setDescription('Symbole (ex: €, 💶)').setRequired(false))
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
    // ── Defer en premier, TOUJOURS, avant tout traitement ──────
    try {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    } catch (e) {
      // Déjà acknowledged — on continue quand même
    }

    // Raccourci : toujours utiliser editReply après le defer
    const reply = async (data) => {
      try {
        return await interaction.editReply(data);
      } catch (err) {
        console.error('[econ-admin] editReply failed:', err?.message);
      }
    };

    try {
      const sub    = interaction.options.getSubcommand();
      const cfg    = db.getConfig(interaction.guildId) || {};
      const symbol = cfg.currency_emoji || '€';

      // ── DONNER ─────────────────────────────────────────────
      if (sub === 'donner') {
        const target = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');
        const raison = interaction.options.getString('raison') || 'Don admin';

        db.addCoins(target.id, interaction.guildId, amount);
        const newUser = db.getUser(target.id, interaction.guildId);

        return await reply({
          embeds: [new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('💸 Don effectué')
            .addFields(
              { name: '👤 Membre',        value: `<@${target.id}>`, inline: true },
              { name: '💰 Montant donné', value: `**+${amount.toLocaleString('fr-FR')}${symbol}**`, inline: true },
              { name: '💎 Nouveau solde', value: `**${(newUser?.balance || 0).toLocaleString('fr-FR')}${symbol}**`, inline: true },
              { name: '📝 Raison',        value: raison, inline: false },
            )
            .setFooter({ text: `Effectué par ${interaction.user.username}` })
            .setTimestamp()
          ]
        });
      }

      // ── RETIRER ────────────────────────────────────────────
      if (sub === 'retirer') {
        const target = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');
        const raison = interaction.options.getString('raison') || 'Retrait admin';

        const userBefore    = db.getUser(target.id, interaction.guildId);
        const actualRemoved = Math.min(amount, userBefore?.balance || 0);
        db.removeCoins(target.id, interaction.guildId, amount);
        const newUser = db.getUser(target.id, interaction.guildId);

        return await reply({
          embeds: [new EmbedBuilder()
            .setColor('#E67E22')
            .setTitle('💰 Retrait effectué')
            .addFields(
              { name: '👤 Membre',        value: `<@${target.id}>`, inline: true },
              { name: '💸 Retiré',        value: `**-${actualRemoved.toLocaleString('fr-FR')}${symbol}**`, inline: true },
              { name: '💎 Nouveau solde', value: `**${(newUser?.balance || 0).toLocaleString('fr-FR')}${symbol}**`, inline: true },
              { name: '📝 Raison',        value: raison, inline: false },
            )
            .setFooter({ text: `Effectué par ${interaction.user.username}` })
            .setTimestamp()
          ]
        });
      }

      // ── RESET ──────────────────────────────────────────────
      if (sub === 'reset') {
        const target = interaction.options.getUser('membre');
        db.db.prepare('UPDATE users SET balance=0, bank=0, total_earned=0 WHERE user_id=? AND guild_id=?')
          .run(target.id, interaction.guildId);
        return await reply({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🔄 Compte remis à zéro')
            .setDescription(`Le compte de <@${target.id}> a été remis à **0${symbol}**.`)
            .setFooter({ text: `Effectué par ${interaction.user.username}` })
          ]
        });
      }

      // ── RESET-ALL ──────────────────────────────────────────
      if (sub === 'reset-all') {
        db.db.prepare('UPDATE users SET balance=0, bank=0, total_earned=0 WHERE guild_id=?')
          .run(interaction.guildId);
        return await reply({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('⚠️ Économie complète remise à zéro')
            .setDescription('Tous les comptes du serveur ont été remis à **0€**.')
            .setFooter({ text: `Effectué par ${interaction.user.username}` })
          ]
        });
      }

      // ── VOIR ───────────────────────────────────────────────
      if (sub === 'voir') {
        const target = interaction.options.getUser('membre');
        const u = db.getUser(target.id, interaction.guildId);
        return await reply({
          embeds: [new EmbedBuilder()
            .setColor(cfg.color || '#7B2FBE')
            .setTitle(`🔍 Compte de ${target.username}`)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
              { name: '👛 Portefeuille', value: `**${(u?.balance || 0).toLocaleString('fr-FR')}${symbol}**`, inline: true },
              { name: '🏦 Banque',       value: `**${(u?.bank || 0).toLocaleString('fr-FR')}${symbol}**`,    inline: true },
              { name: '💎 Total gagné',  value: `**${(u?.total_earned || 0).toLocaleString('fr-FR')}${symbol}**`, inline: true },
            )
          ]
        });
      }

      // ── DEFINIR ────────────────────────────────────────────
      if (sub === 'definir') {
        const target = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');
        db.db.prepare('UPDATE users SET balance=? WHERE user_id=? AND guild_id=?')
          .run(amount, target.id, interaction.guildId);
        return await reply({
          embeds: [new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('✏️ Solde défini')
            .setDescription(`Le solde de <@${target.id}> est maintenant **${amount.toLocaleString('fr-FR')}${symbol}**.`)
            .setFooter({ text: `Effectué par ${interaction.user.username}` })
          ]
        });
      }

      // ── CONFIG ─────────────────────────────────────────────
      if (sub === 'config') {
        const nom = interaction.options.getString('nom');
        const sym = interaction.options.getString('symbole');
        if (nom) db.setConfig(interaction.guildId, 'currency_name',  nom);
        if (sym) db.setConfig(interaction.guildId, 'currency_emoji', sym);
        return await reply({
          embeds: [new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('⚙️ Économie configurée')
            .addFields(
              ...(nom ? [{ name: '🏷️ Nom',    value: nom, inline: true }] : []),
              ...(sym ? [{ name: '💱 Symbole', value: sym, inline: true }] : []),
            )
            .setDescription('Configuration mise à jour avec succès !')
            .setFooter({ text: `Par ${interaction.user.username}` })
          ]
        });
      }

      // ── DONNER-ROLE ────────────────────────────────────────
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
        return await reply({
          embeds: [new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('👥 Don de masse effectué')
            .addFields(
              { name: '👥 Rôle',            value: `<@&${role.id}>`, inline: true },
              { name: '👤 Membres',          value: `**${count}**`, inline: true },
              { name: '💰 Par membre',       value: `**+${amount.toLocaleString('fr-FR')}${symbol}**`, inline: true },
              { name: '💸 Total distribué',  value: `**${(count * amount).toLocaleString('fr-FR')}${symbol}**`, inline: true },
            )
            .setFooter({ text: `Effectué par ${interaction.user.username}` })
            .setTimestamp()
          ]
        });
      }

      // ── STATS ──────────────────────────────────────────────
      if (sub === 'stats') {
        const totalUsers = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=?').get(interaction.guildId)?.c || 0;
        const totalMoney = db.db.prepare('SELECT SUM(balance + bank) as s FROM users WHERE guild_id=?').get(interaction.guildId)?.s || 0;
        const richest    = db.db.prepare('SELECT user_id, balance+bank as total FROM users WHERE guild_id=? ORDER BY total DESC LIMIT 1').get(interaction.guildId);
        const avgBalance = totalUsers > 0 ? Math.round(totalMoney / totalUsers) : 0;
        const broke      = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=? AND balance+bank=0').get(interaction.guildId)?.c || 0;

        return await reply({
          embeds: [new EmbedBuilder()
            .setColor(cfg.color || '#7B2FBE')
            .setTitle('📊 Économie du serveur')
            .addFields(
              { name: '👤 Membres',        value: `**${totalUsers}**`, inline: true },
              { name: '💰 En circulation', value: `**${totalMoney.toLocaleString('fr-FR')}${symbol}**`, inline: true },
              { name: '📊 Moyenne',        value: `**${avgBalance.toLocaleString('fr-FR')}${symbol}**`, inline: true },
              { name: '💸 À sec',          value: `**${broke}** membre(s)`, inline: true },
              { name: '🏆 Plus riche',     value: richest ? `<@${richest.user_id}> — ${richest.total.toLocaleString('fr-FR')}${symbol}` : 'N/A', inline: false },
            )
            .setTimestamp()
          ]
        });
      }

      // Sous-commande inconnue
      return await reply({ content: '❌ Sous-commande inconnue.' });

    } catch (err) {
      console.error('[econ-admin] Erreur execute:', err?.message || err);
      await reply({ content: `❌ Erreur : ${err?.message || 'Erreur inconnue'}` });
    }
  },
};
