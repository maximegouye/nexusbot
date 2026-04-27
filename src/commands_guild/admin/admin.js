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
    .addSubcommand(sub => sub.setName('config').setDescription('Afficher la configuration du serveur'))
    .addSubcommand(sub => sub.setName('remboursement-ajouter').setDescription('Ajouter un remboursement en attente')
      .addUserOption(o => o.setName('utilisateur').setDescription('Utilisateur à rembourser').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à rembourser').setMinValue(1).setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison du remboursement').setRequired(false).setMaxLength(200)))
    .addSubcommand(sub => sub.setName('remboursement-envoyer').setDescription('Envoyer TOUS les remboursements en attente'))
    .addSubcommand(sub => sub.setName('remboursement-liste').setDescription('Voir les remboursements en attente'))
    .addSubcommand(sub => sub.setName('remboursement-direct').setDescription('Rembourser immédiatement sans file')
      .addUserOption(o => o.setName('utilisateur').setDescription('Utilisateur').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant').setMinValue(1).setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false).setMaxLength(200))
      .addChannelOption(o => o.setName('salon').setDescription('Salon où annoncer publiquement').setRequired(false))),

  category: 'admin',

  async execute(interaction) {
    try {
    // Vérification permission (null-safe)
    const isAdmin = interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
      || interaction.guild?.ownerId === interaction.user.id;
    if (!isAdmin) {
      if (!interaction.deferred && !interaction.replied) {
        return interaction.reply({ content: '🚫 Réservé aux administrateurs.', ephemeral: true }).catch(() => {});
      }
      return interaction.editReply({ content: '🚫 Réservé aux administrateurs.' }).catch(() => {});
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

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

    // ── Remboursements — Ajouter ────────────────────────────
    if (sub === 'remboursement-ajouter') {
      const target = interaction.options.getUser('utilisateur');
      const amount = interaction.options.getInteger('montant');
      const raison = interaction.options.getString('raison') || 'Bug technique — gain non versé (bug slots)';

      db.db.prepare('INSERT INTO remboursements (guild_id, user_id, amount, raison) VALUES (?,?,?,?)')
        .run(guildId, target.id, amount, raison);

      const cfg = db.getConfig ? db.getConfig(guildId) : null;
      const coin = cfg?.currency_emoji || '€';
      return reply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('✅ Remboursement enregistré')
          .setDescription(`<@${target.id}> recevra **${amount.toLocaleString('fr-FR')} ${coin}** dès l'envoi.`)
          .addFields({ name: '📋 Raison', value: raison })
      ]});
    }

    // ── Remboursements — Envoyer ────────────────────────────
    if (sub === 'remboursement-envoyer') {
      const pending = db.db.prepare('SELECT * FROM remboursements WHERE guild_id=? AND sent=0 ORDER BY id ASC').all(guildId);

      if (!pending.length) {
        return reply({ content: '✅ Aucun remboursement en attente.', ephemeral: true });
      }

      let success = 0;
      const lines = [];
      const cfg = db.getConfig ? db.getConfig(guildId) : null;
      const coin = cfg?.currency_emoji || '€';
      const { sendRemboursement } = require('./remboursement');

      for (const r of pending) {
        const ok = await sendRemboursement(interaction.client, guildId, r.user_id, r.amount, r.raison);
        if (ok) {
          db.db.prepare('UPDATE remboursements SET sent=1, sent_at=? WHERE id=?').run(Math.floor(Date.now()/1000), r.id);
          lines.push(`✅ <@${r.user_id}> → **+${r.amount.toLocaleString('fr-FR')} ${coin}**`);
          success++;
        } else {
          lines.push(`❌ <@${r.user_id}> → erreur`);
        }
      }

      const publicEmbed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('💸 Remboursements envoyés — Bug technique corrigé')
        .setDescription(
          `Suite à un bug qui a pu empêcher certains gains d'être crédités, ` +
          `**${success} membre(s)** viennent d'être remboursés automatiquement.\n\n` +
          `Les coins ont été ajoutés directement sur leur compte. Un DM de confirmation leur a été envoyé.\n\n` +
          `**Merci pour votre patience. 🙏**`
        )
        .addFields({ name: '📊 Récapitulatif', value: lines.slice(0, 20).join('\n') || '—' })
        .setFooter({ text: 'NexusBot — Zone Entraide' })
        .setTimestamp();

      return reply({ embeds: [publicEmbed] });
    }

    // ── Remboursements — Liste ──────────────────────────────
    if (sub === 'remboursement-liste') {
      const pending = db.db.prepare('SELECT * FROM remboursements WHERE guild_id=? AND sent=0 ORDER BY id ASC').all(guildId);
      const done    = db.db.prepare('SELECT COUNT(*) as c FROM remboursements WHERE guild_id=? AND sent=1').get(guildId);
      const cfg = db.getConfig ? db.getConfig(guildId) : null;
      const coin = cfg?.currency_emoji || '€';

      if (!pending.length) {
        return reply({ content: `✅ Aucun remboursement en attente. (${done?.c || 0} déjà envoyés)` });
      }

      const lines = pending.map(r => `<@${r.user_id}> — **${r.amount.toLocaleString('fr-FR')} ${coin}** | ${r.raison}`);
      return reply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle(`📋 Remboursements en attente (${pending.length})`)
          .setDescription(lines.slice(0, 25).join('\n'))
          .setFooter({ text: `${done?.c || 0} déjà envoyés` })
      ]});
    }

    // ── Remboursements — Direct ─────────────────────────────
    if (sub === 'remboursement-direct') {
      const target  = interaction.options.getUser('utilisateur');
      const amount  = interaction.options.getInteger('montant');
      const raison  = interaction.options.getString('raison') || 'Remboursement — bug technique';
      const salon   = interaction.options.getChannel('salon') || interaction.channel;
      const { sendRemboursement } = require('./remboursement');

      const ok = await sendRemboursement(interaction.client, guildId, target.id, amount, raison, salon?.id);
      if (!ok) return reply({ content: '❌ Erreur lors du remboursement.', ephemeral: true });

      db.db.prepare('INSERT INTO remboursements (guild_id, user_id, amount, raison, sent, sent_at) VALUES (?,?,?,?,1,?)')
        .run(guildId, target.id, amount, raison, Math.floor(Date.now()/1000));

      const newBalance = db.getUser(target.id, guildId)?.balance || 0;
      const cfg = db.getConfig ? db.getConfig(guildId) : null;
      const coin = cfg?.currency_emoji || '€';
      const publicEmbed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('💸 Remboursement effectué !')
        .setDescription(
          `<@${target.id}> a été remboursé suite à un bug technique.\n\n` +
          `Désolé pour ce désagrément — ton gain t'appartient et il est maintenant sur ton compte. 🙏`
        )
        .addFields(
          { name: '💰 Montant remboursé', value: `**+${amount.toLocaleString('fr-FR')} ${coin}**`, inline: true },
          { name: '👛 Nouveau solde', value: `${newBalance.toLocaleString('fr-FR')} ${coin}`, inline: true },
          { name: '📋 Raison', value: raison, inline: false },
        )
        .setFooter({ text: 'NexusBot — Zone Entraide' })
        .setTimestamp();

      return reply({ embeds: [publicEmbed] });
    }
    } catch (err) {
      console.error('[ADMIN] execute error:', err?.message || err);
      try {
        const errMsg = { content: `❌ Erreur : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.editReply(errMsg).catch(() => {});
        else await interaction.reply(errMsg).catch(() => {});
      } catch {}
    }
  },
};
