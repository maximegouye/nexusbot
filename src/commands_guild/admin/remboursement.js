/**
 * NexusBot — Système de remboursement pour victimes du bug slots/casino
 * /remboursement ajouter @user montant raison
 * /remboursement envoyer   → envoie TOUS les remboursements en attente dans la DB
 * /remboursement liste     → voir les remboursements en attente
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// Créer la table si elle n'existe pas
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS remboursements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    amount INTEGER NOT NULL,
    raison TEXT DEFAULT 'Bug technique — gain non versé',
    sent INTEGER DEFAULT 0,
    sent_at INTEGER,
    added_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

// ─── Envoi d'un remboursement unique ────────────────────────────────────────
async function sendRemboursement(client, guildId, userId, amount, raison) {
  try {
    db.addCoins(userId, guildId, amount);
    const newBalance = db.getUser(userId, guildId)?.balance || 0;

    // Tentative DM
    try {
      const user = await client.users.fetch(userId);
      const dmEmbed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('💸 Remboursement de NexusBot')
        .setDescription(
          `Bonjour <@${userId}> ! 🙏\n\n` +
          `Suite à un **bug technique** qui a pu empêcher certains gains d'être crédités correctement, ` +
          `NexusBot te rembourse automatiquement.\n\n` +
          `Nous sommes sincèrement désolés pour ce désagrément.`
        )
        .addFields(
          { name: '💰 Montant remboursé', value: `**+${amount.toLocaleString('fr-FR')} €**`, inline: true },
          { name: '📋 Raison', value: raison, inline: true },
          { name: '👛 Nouveau solde', value: `${newBalance.toLocaleString('fr-FR')} €`, inline: true },
        )
        .setFooter({ text: 'NexusBot — Zone Entraide' })
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] });
    } catch {}

    return true;
  } catch (e) {
    console.error('[REMBOURS] Erreur:', e.message);
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remboursement')
    .setDescription('💸 Système de remboursement — victimes du bug casino')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(s => s.setName('ajouter')
      .setDescription('➕ Ajouter un remboursement en attente')
      .addUserOption(o => o.setName('utilisateur').setDescription('Utilisateur à rembourser').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à rembourser').setMinValue(1).setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison du remboursement').setRequired(false).setMaxLength(200)))

    .addSubcommand(s => s.setName('envoyer')
      .setDescription('🚀 Envoyer TOUS les remboursements en attente + message public'))

    .addSubcommand(s => s.setName('liste')
      .setDescription('📋 Voir les remboursements en attente'))

    .addSubcommand(s => s.setName('direct')
      .setDescription('⚡ Rembourser immédiatement sans file d\'attente')
      .addUserOption(o => o.setName('utilisateur').setDescription('Utilisateur').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant').setMinValue(1).setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false).setMaxLength(200))
      .addChannelOption(o => o.setName('salon').setDescription('Salon où annoncer publiquement').setRequired(false))),

  sendRemboursement,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const cfg     = db.getConfig(guildId);
    const coin    = cfg.currency_emoji || '€';

    // ── Ajouter en file d'attente ───────────────────────────────────────────
    if (sub === 'ajouter') {
      const target = interaction.options.getUser('utilisateur');
      const amount = interaction.options.getInteger('montant');
      const raison = interaction.options.getString('raison') || 'Bug technique — gain non versé (bug slots)';

      db.db.prepare('INSERT INTO remboursements (guild_id, user_id, amount, raison) VALUES (?,?,?,?)')
        .run(guildId, target.id, amount, raison);

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('✅ Remboursement enregistré')
          .setDescription(`<@${target.id}> recevra **${amount.toLocaleString('fr-FR')} ${coin}** dès l'envoi.`)
          .addFields({ name: '📋 Raison', value: raison })
      ]});
    }

    // ── Envoyer tous les remboursements en attente ──────────────────────────
    if (sub === 'envoyer') {
      const pending = db.db.prepare('SELECT * FROM remboursements WHERE guild_id=? AND sent=0 ORDER BY id ASC').all(guildId);

      if (!pending.length) {
        return interaction.editReply({ content: '✅ Aucun remboursement en attente.', ephemeral: true });
      }

      let success = 0, fail = 0;
      const lines = [];

      for (const r of pending) {
        const ok = await sendRemboursement(interaction.client, guildId, r.user_id, r.amount, r.raison);
        if (ok) {
          db.db.prepare('UPDATE remboursements SET sent=1, sent_at=? WHERE id=?').run(Math.floor(Date.now()/1000), r.id);
          lines.push(`✅ <@${r.user_id}> → **+${r.amount.toLocaleString('fr-FR')} ${coin}**`);
          success++;
        } else {
          lines.push(`❌ <@${r.user_id}> → erreur`);
          fail++;
        }
      }

      // Annonce publique dans le salon actuel
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

      await interaction.editReply({ embeds: [publicEmbed] });
      return;
    }

    // ── Liste des remboursements en attente ─────────────────────────────────
    if (sub === 'liste') {
      const pending = db.db.prepare('SELECT * FROM remboursements WHERE guild_id=? AND sent=0 ORDER BY id ASC').all(guildId);
      const done    = db.db.prepare('SELECT COUNT(*) as c FROM remboursements WHERE guild_id=? AND sent=1').get(guildId);

      if (!pending.length) {
        return interaction.editReply({ content: `✅ Aucun remboursement en attente. (${done?.c || 0} déjà envoyés)` });
      }

      const lines = pending.map(r => `<@${r.user_id}> — **${r.amount.toLocaleString('fr-FR')} ${coin}** | ${r.raison}`);
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle(`📋 Remboursements en attente (${pending.length})`)
          .setDescription(lines.slice(0, 25).join('\n'))
          .setFooter({ text: `${done?.c || 0} déjà envoyés` })
      ]});
    }

    // ── Remboursement direct immédiat ───────────────────────────────────────
    if (sub === 'direct') {
      const target  = interaction.options.getUser('utilisateur');
      const amount  = interaction.options.getInteger('montant');
      const raison  = interaction.options.getString('raison') || 'Remboursement — bug technique';
      const salon   = interaction.options.getChannel('salon') || interaction.channel;

      const ok = await sendRemboursement(interaction.client, guildId, target.id, amount, raison);
      if (!ok) return interaction.editReply({ content: '❌ Erreur lors du remboursement.', ephemeral: true });

      // Log en DB
      db.db.prepare('INSERT INTO remboursements (guild_id, user_id, amount, raison, sent, sent_at) VALUES (?,?,?,?,1,?)')
        .run(guildId, target.id, amount, raison, Math.floor(Date.now()/1000));

      const newBalance = db.getUser(target.id, guildId)?.balance || 0;
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

      // Poster dans le salon précisé (public)
      try {
        if (salon && salon.id !== interaction.channel.id) await salon.send({ embeds: [publicEmbed] });
      } catch {}

      return interaction.editReply({ embeds: [publicEmbed] });
    }
  },
};
