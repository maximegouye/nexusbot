const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const COLOR = 0xE74C3C;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Commandes réservées aux administrateurs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('donner').setDescription('Donner des coins à un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub.setName('retirer').setDescription('Retirer des coins à un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub.setName('reset').setDescription('Remettre le solde à zéro')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true)))
    .addSubcommand(sub => sub.setName('cooldown').setDescription('Réinitialiser les cooldowns')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true)))
    .addSubcommand(sub => sub.setName('solde').setDescription('Voir le solde exact')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true)))
    .addSubcommand(sub => sub.setName('config').setDescription('Afficher la configuration du serveur')),

  category: 'admin',

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      const fn = interaction.deferred || interaction.replied ? interaction.editReply : interaction.reply;
      return fn.bind(interaction)({ content: '🚫 Réservé aux administrateurs.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });

    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const reply   = (data) => interaction.editReply(data).catch(() => {});

    // ── Donner des coins ────────────────────────────────────────
    if (sub === 'donner') {
      const membre  = interaction.options.getUser('membre');
      const montant = interaction.options.getInteger('montant');
      db.addCoins(membre.id, guildId, montant);
      const u = db.getUser(membre.id, guildId);
      return reply({ embeds: [new EmbedBuilder()
        .setColor(0x2ECC71).setTitle('💰 Coins ajoutés')
        .setDescription(`**${membre.username}** a reçu **+${montant.toLocaleString('fr-FR')} coins**.\nSolde : **${(u?.balance || 0).toLocaleString('fr-FR')} coins**`)
        .setFooter({ text: `Action par ${interaction.user.username}` }).setTimestamp()] });
    }

    // ── Retirer des coins ───────────────────────────────────────
    if (sub === 'retirer') {
      const membre  = interaction.options.getUser('membre');
      const montant = interaction.options.getInteger('montant');
      const before  = db.getUser(membre.id, guildId)?.balance || 0;
      const toRemove = Math.min(montant, before);
      if (toRemove > 0) db.removeCoins(membre.id, guildId, toRemove);
      const u = db.getUser(membre.id, guildId);
      return reply({ embeds: [new EmbedBuilder()
        .setColor(COLOR).setTitle('➖ Coins retirés')
        .setDescription(`**${membre.username}** a perdu **${toRemove.toLocaleString('fr-FR')} coins**.\nSolde : **${(u?.balance || 0).toLocaleString('fr-FR')} coins**`)
        .setFooter({ text: `Action par ${interaction.user.username}` }).setTimestamp()] });
    }

    // ── Reset solde ─────────────────────────────────────────────
    if (sub === 'reset') {
      const membre = interaction.options.getUser('membre');
      try {
        db.db.prepare('UPDATE users SET balance=0, bank=0 WHERE user_id=? AND guild_id=?').run(membre.id, guildId);
      } catch {}
      return reply({ embeds: [new EmbedBuilder()
        .setColor(COLOR).setTitle('🔄 Solde remis à zéro')
        .setDescription(`Solde de **${membre.username}** → **0 coins**`)
        .setFooter({ text: `Action par ${interaction.user.username}` }).setTimestamp()] });
    }

    // ── Reset cooldowns ─────────────────────────────────────────
    if (sub === 'cooldown') {
      const membre = interaction.options.getUser('membre');
      try {
        db.db.prepare(
          'UPDATE users SET last_daily=0, last_work=0, last_crime=0, last_rob=0, last_message=0 WHERE user_id=? AND guild_id=?'
        ).run(membre.id, guildId);
      } catch {}
      return reply({ embeds: [new EmbedBuilder()
        .setColor(0x3498DB).setTitle('⏱️ Cooldowns réinitialisés')
        .setDescription(`Tous les cooldowns de **${membre.username}** ont été remis à zéro.`)
        .setFooter({ text: `Action par ${interaction.user.username}` }).setTimestamp()] });
    }

    // ── Voir solde ──────────────────────────────────────────────
    if (sub === 'solde') {
      const membre = interaction.options.getUser('membre');
      const u      = db.getUser(membre.id, guildId);
      const cfg    = db.getConfig ? db.getConfig(guildId) : null;
      const coin   = cfg?.currency_emoji || '🪙';
      return reply({ embeds: [new EmbedBuilder()
        .setColor(0xF39C12).setTitle('👁️ Solde membre')
        .addFields(
          { name: '👤 Membre',       value: `**${membre.username}**`,                                         inline: true },
          { name: '💰 Portefeuille', value: `**${(u?.balance || 0).toLocaleString('fr-FR')} ${coin}**`,       inline: true },
          { name: '🏦 Banque',       value: `**${(u?.bank || 0).toLocaleString('fr-FR')} ${coin}**`,          inline: true },
          { name: '📈 Total gagné',  value: `**${(u?.total_earned || 0).toLocaleString('fr-FR')} ${coin}**`,  inline: true },
        )
        .setFooter({ text: `Consulté par ${interaction.user.username}` }).setTimestamp()] });
    }

    // ── Config serveur ──────────────────────────────────────────
    if (sub === 'config') {
      const guild = interaction.guild;
      const cfg   = db.getConfig ? db.getConfig(guildId) : null;
      return reply({ embeds: [new EmbedBuilder()
        .setColor(0x9B59B6).setTitle(`⚙️ Config — ${guild.name}`)
        .addFields(
          { name: '🆔 Guild ID',    value: guild.id,                                                  inline: true },
          { name: '👥 Membres',     value: `${guild.memberCount}`,                                    inline: true },
          { name: '💱 Monnaie',     value: `${cfg?.currency_emoji || '🪙'} ${cfg?.currency_name || 'Coins'}`, inline: true },
          { name: '📅 Daily',       value: `${cfg?.daily_amount || 25} coins`,                        inline: true },
          { name: '🌟 XP activé',   value: cfg?.xp_enabled ? '✅' : '❌',                            inline: true },
          { name: '💰 Éco activée', value: cfg?.eco_enabled ? '✅' : '❌',                           inline: true },
          { name: '📊 DB',          value: 'SQLite ✅',                                               inline: true },
        )
        .setTimestamp()] });
    }
  },
};
