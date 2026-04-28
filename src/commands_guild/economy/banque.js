/**
 * /banque — Système bancaire complet
 * Sous-commandes : solde · deposer · retirer · pret · rembourser
 * Boutons: banque_dep_, banque_wit_, banque_pret_, banque_rem_
 */
const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const db = require('../../database/db');

const LOAN_INTEREST   = 0.15;    // 15% d'intérêts
const LOAN_MAX_RATIO  = 0.30;    // Prêt max = 30% de la fortune totale
const LOAN_MAX_ABS    = 500_000; // Plafond absolu
const LOAN_DURATION_H = 48;      // Durée de remboursement en heures

// ── Helpers ──────────────────────────────────────────────────────────────────

function getActiveLoan(userId, guildId) {
  return db.db.prepare(
    'SELECT * FROM loans WHERE guild_id=? AND user_id=? AND paid=0 ORDER BY id DESC LIMIT 1'
  ).get(guildId, userId) || null;
}

function buildBalanceEmbed(user, cfg, target, rank, totalMembers) {
  const sym  = cfg.currency_emoji || '€';
  const name = cfg.currency_name  || 'Euros';
  const net  = user.balance + user.bank;
  const pct  = totalMembers > 1 ? Math.round((1 - (rank - 1) / totalMembers) * 100) : 100;
  const loan = getActiveLoan(target.id, cfg._guildId);

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle(`🏦 Banque NexusBot — ${target.username}`)
    .setThumbnail(target.displayAvatarURL ? target.displayAvatarURL({ size: 128 }) : null)
    .addFields(
      { name: '👛 Portefeuille', value: `**${user.balance.toLocaleString('fr-FR')} ${sym}**`, inline: true },
      { name: '🏦 Banque',       value: `**${user.bank.toLocaleString('fr-FR')} ${sym}**`,    inline: true },
      { name: '💎 Fortune',      value: `**${net.toLocaleString('fr-FR')} ${sym}**`,           inline: true },
      { name: '🏆 Classement',   value: `**#${rank}** sur ${totalMembers}`,                   inline: true },
      { name: '📊 Percentile',   value: `**Top ${100 - pct + 1}%**`,                          inline: true },
      { name: '​',          value: '​',                                              inline: true },
    );

  if (loan) {
    const now    = Math.floor(Date.now() / 1000);
    const left   = Math.max(0, loan.due_at - now);
    const hLeft  = Math.floor(left / 3600);
    const mLeft  = Math.floor((left % 3600) / 60);
    const status = left === 0 ? '⚠️ **EN RETARD**' : `⏳ ${hLeft}h ${mLeft}min restant(es)`;
    embed.addFields({
      name: '💳 Prêt en cours',
      value: `Montant dû : **${loan.total_due.toLocaleString('fr-FR')} ${sym}**\n${status}`,
      inline: false,
    });
  }

  embed.setFooter({ text: '💡 Utilise les boutons ci-dessous pour gérer ta banque' }).setTimestamp();
  return embed;
}

function buildButtons(userId, hasloan) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`banque_dep_${userId}`)
      .setLabel('📥 Déposer')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`banque_wit_${userId}`)
      .setLabel('📤 Retirer')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`banque_pret_${userId}`)
      .setLabel('💳 Prêt')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(hasloan),
    new ButtonBuilder()
      .setCustomId(`banque_rem_${userId}`)
      .setLabel('✅ Rembourser')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!hasloan),
    new ButtonBuilder()
      .setCustomId(`banque_ref_${userId}`)
      .setLabel('🔄 Actualiser')
      .setStyle(ButtonStyle.Secondary),
  );
  return row;
}

async function showSolde(interaction, targetUser) {
  targetUser = targetUser || interaction.user;
  const cfg   = db.getConfig(interaction.guildId);
  cfg._guildId = interaction.guildId;
  const user  = db.getUser(targetUser.id, interaction.guildId);
  const rank  = db.db.prepare(
    'SELECT COUNT(*) as r FROM users WHERE guild_id=? AND (balance+bank)>?'
  ).get(interaction.guildId, user.balance + user.bank).r + 1;
  const total = db.db.prepare(
    'SELECT COUNT(*) as c FROM users WHERE guild_id=? AND (balance+bank)>0'
  ).get(interaction.guildId).c;

  const loan  = getActiveLoan(targetUser.id, interaction.guildId);
  const embed = buildBalanceEmbed(user, cfg, targetUser, rank, total);
  const row   = buildButtons(interaction.user.id, !!loan);

  const send = (interaction.deferred || interaction.replied)
    ? interaction.editReply.bind(interaction)
    : interaction.reply.bind(interaction);
  await send({ embeds: [embed], components: [row] }).catch(() => {});
}

// ── Deposit / Withdraw helpers ─────────────────────────────────────────────

async function doDeposit(interaction, amountRaw) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }
  const cfg  = db.getConfig(interaction.guildId);
  const sym  = cfg.currency_emoji || '€';
  const user = db.getUser(interaction.user.id, interaction.guildId);

  let amount = (amountRaw === 'tout' || amountRaw === 'all')
    ? user.balance
    : (typeof amountRaw === 'number' ? amountRaw : parseInt(amountRaw));

  if (isNaN(amount) || amount <= 0)
    return interaction.editReply({ content: '❌ Montant invalide.' }).catch(() => {});
  if (amount > user.balance)
    return interaction.editReply({ content: `❌ Solde insuffisant. Tu as **${user.balance.toLocaleString('fr-FR')} ${sym}** en poche.` }).catch(() => {});

  db.db.prepare('UPDATE users SET balance=balance-?, bank=bank+? WHERE user_id=? AND guild_id=?')
    .run(amount, amount, interaction.user.id, interaction.guildId);

  const upd = db.getUser(interaction.user.id, interaction.guildId);
  const embed = new EmbedBuilder()
    .setColor('#2ECC71')
    .setTitle('📥 Dépôt effectué')
    .addFields(
      { name: 'Déposé',        value: `**+${amount.toLocaleString('fr-FR')} ${sym}**`,       inline: true },
      { name: 'Portefeuille',  value: `**${upd.balance.toLocaleString('fr-FR')} ${sym}**`,   inline: true },
      { name: 'Banque',        value: `**${upd.bank.toLocaleString('fr-FR')} ${sym}**`,       inline: true },
    )
    .setFooter({ text: 'Les € en banque sont protégés du vol !' })
    .setTimestamp();
  await interaction.editReply({ embeds: [embed] }).catch(() => {});
}

async function doWithdraw(interaction, amountRaw) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }
  const cfg  = db.getConfig(interaction.guildId);
  const sym  = cfg.currency_emoji || '€';
  const user = db.getUser(interaction.user.id, interaction.guildId);

  let amount = (amountRaw === 'tout' || amountRaw === 'all')
    ? user.bank
    : (typeof amountRaw === 'number' ? amountRaw : parseInt(amountRaw));

  if (isNaN(amount) || amount <= 0)
    return interaction.editReply({ content: '❌ Montant invalide.' }).catch(() => {});
  if (amount > user.bank)
    return interaction.editReply({ content: `❌ Solde bancaire insuffisant. Tu as **${user.bank.toLocaleString('fr-FR')} ${sym}** en banque.` }).catch(() => {});

  db.db.prepare('UPDATE users SET bank=bank-?, balance=balance+? WHERE user_id=? AND guild_id=?')
    .run(amount, amount, interaction.user.id, interaction.guildId);

  const upd = db.getUser(interaction.user.id, interaction.guildId);
  const embed = new EmbedBuilder()
    .setColor('#3498DB')
    .setTitle('📤 Retrait effectué')
    .addFields(
      { name: 'Retiré',        value: `**${amount.toLocaleString('fr-FR')} ${sym}**`,        inline: true },
      { name: 'Portefeuille',  value: `**${upd.balance.toLocaleString('fr-FR')} ${sym}**`,   inline: true },
      { name: 'Banque',        value: `**${upd.bank.toLocaleString('fr-FR')} ${sym}**`,       inline: true },
    )
    .setFooter({ text: 'Argent retiré avec succès !' })
    .setTimestamp();
  await interaction.editReply({ embeds: [embed] }).catch(() => {});
}

async function doLoan(interaction, amountRaw) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }
  const cfg  = db.getConfig(interaction.guildId);
  const sym  = cfg.currency_emoji || '€';
  const user = db.getUser(interaction.user.id, interaction.guildId);

  // Vérifier prêt existant
  const existing = getActiveLoan(interaction.user.id, interaction.guildId);
  if (existing) {
    return interaction.editReply({
      content: `❌ Tu as déjà un prêt en cours ! Rembourse **${existing.total_due.toLocaleString('fr-FR')} ${sym}** d'abord.`
    }).catch(() => {});
  }

  const maxLoan = Math.min(
    Math.floor((user.balance + user.bank) * LOAN_MAX_RATIO),
    LOAN_MAX_ABS
  );

  if (maxLoan < 100) {
    return interaction.editReply({
      content: `❌ Ta fortune est trop faible pour obtenir un prêt (minimum 100 ${sym} de fortune totale).`
    }).catch(() => {});
  }

  let amount = amountRaw === 'max' ? maxLoan : parseInt(amountRaw);

  if (isNaN(amount) || amount <= 0)
    return interaction.editReply({ content: '❌ Montant invalide.' }).catch(() => {});
  if (amount > maxLoan)
    return interaction.editReply({
      content: `❌ Prêt maximum : **${maxLoan.toLocaleString('fr-FR')} ${sym}** (30% de ta fortune).`
    }).catch(() => {});

  const interest  = Math.ceil(amount * LOAN_INTEREST);
  const totalDue  = amount + interest;
  const dueAt     = Math.floor(Date.now() / 1000) + LOAN_DURATION_H * 3600;

  db.db.prepare(
    'INSERT INTO loans (guild_id, user_id, amount, interest, total_due, due_at) VALUES (?,?,?,?,?,?)'
  ).run(interaction.guildId, interaction.user.id, amount, interest, totalDue, dueAt);

  db.addCoins(interaction.user.id, interaction.guildId, amount);

  const embed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('💳 Prêt accordé !')
    .setDescription(`Tu as reçu **${amount.toLocaleString('fr-FR')} ${sym}** directement dans ton portefeuille.`)
    .addFields(
      { name: '💰 Montant emprunté', value: `**${amount.toLocaleString('fr-FR')} ${sym}**`,   inline: true },
      { name: '💸 Intérêts (15%)',   value: `**${interest.toLocaleString('fr-FR')} ${sym}**`, inline: true },
      { name: '🧾 Total à rembourser', value: `**${totalDue.toLocaleString('fr-FR')} ${sym}**`, inline: true },
      { name: '⏳ Délai',            value: `**${LOAN_DURATION_H} heures**`,                   inline: true },
      { name: '⚠️ Attention',        value: `En cas de non-remboursement à temps, la somme sera prélevée de force sur ton compte.`, inline: false },
    )
    .setFooter({ text: `Utilise /banque rembourser ou le bouton ✅ Rembourser` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] }).catch(() => {});
}

async function doRepay(interaction) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }
  const cfg  = db.getConfig(interaction.guildId);
  const sym  = cfg.currency_emoji || '€';

  const loan = getActiveLoan(interaction.user.id, interaction.guildId);
  if (!loan) {
    return interaction.editReply({ content: '✅ Tu n\'as aucun prêt en cours à rembourser.' }).catch(() => {});
  }

  const user = db.getUser(interaction.user.id, interaction.guildId);
  const totalAvail = user.balance + user.bank;

  if (totalAvail < loan.total_due) {
    return interaction.editReply({
      content: `❌ Fonds insuffisants. Tu dois **${loan.total_due.toLocaleString('fr-FR')} ${sym}** mais tu n'as que **${totalAvail.toLocaleString('fr-FR')} ${sym}** en tout.`
    }).catch(() => {});
  }

  // Prélever en priorité sur le portefeuille, puis la banque si insuffisant
  let remaining = loan.total_due;
  const fromBalance = Math.min(user.balance, remaining);
  remaining -= fromBalance;
  const fromBank = remaining;

  db.db.prepare(
    'UPDATE users SET balance=balance-?, bank=bank-? WHERE user_id=? AND guild_id=?'
  ).run(fromBalance, fromBank, interaction.user.id, interaction.guildId);

  db.db.prepare('UPDATE loans SET paid=1 WHERE id=?').run(loan.id);

  const upd = db.getUser(interaction.user.id, interaction.guildId);
  const embed = new EmbedBuilder()
    .setColor('#2ECC71')
    .setTitle('✅ Prêt remboursé !')
    .addFields(
      { name: '🧾 Montant remboursé', value: `**${loan.total_due.toLocaleString('fr-FR')} ${sym}**`, inline: true },
      { name: '👛 Portefeuille',      value: `**${upd.balance.toLocaleString('fr-FR')} ${sym}**`,    inline: true },
      { name: '🏦 Banque',            value: `**${upd.bank.toLocaleString('fr-FR')} ${sym}**`,        inline: true },
    )
    .setFooter({ text: 'Bravo ! Tu peux faire un nouveau prêt.' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] }).catch(() => {});
}

// ── handleComponent ───────────────────────────────────────────────────────────

async function handleComponent(interaction) {
  const cid    = interaction.customId;
  const userId = interaction.user.id;

  // ── Modals ────────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    if (cid.startsWith('banque_dep_modal_')) {
      const val = interaction.fields.getTextInputValue('montant').trim().toLowerCase();
      return doDeposit(interaction, val);
    }
    if (cid.startsWith('banque_wit_modal_')) {
      const val = interaction.fields.getTextInputValue('montant').trim().toLowerCase();
      return doWithdraw(interaction, val);
    }
    if (cid.startsWith('banque_pret_modal_')) {
      const val = interaction.fields.getTextInputValue('montant').trim().toLowerCase();
      return doLoan(interaction, val);
    }
    return;
  }

  // Vérif propriétaire du bouton
  const parts = cid.split('_');
  const ownerId = parts[parts.length - 1];
  if (ownerId !== userId) {
    return interaction.reply({ content: '❌ Ces boutons ne t\'appartiennent pas.', ephemeral: true }).catch(() => {});
  }

  // ── Bouton Déposer ────────────────────────────────────────────────────────
  if (cid.startsWith('banque_dep_')) {
    const modal = new ModalBuilder()
      .setCustomId(`banque_dep_modal_${userId}`)
      .setTitle('📥 Déposer en banque');
    const input = new TextInputBuilder()
      .setCustomId('montant')
      .setLabel('Montant à déposer (ou "tout")')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('ex: 5000 ou tout')
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  // ── Bouton Retirer ────────────────────────────────────────────────────────
  if (cid.startsWith('banque_wit_')) {
    const modal = new ModalBuilder()
      .setCustomId(`banque_wit_modal_${userId}`)
      .setTitle('📤 Retirer de la banque');
    const input = new TextInputBuilder()
      .setCustomId('montant')
      .setLabel('Montant à retirer (ou "tout")')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('ex: 5000 ou tout')
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  // ── Bouton Prêt ───────────────────────────────────────────────────────────
  if (cid.startsWith('banque_pret_')) {
    const cfg  = db.getConfig(interaction.guildId);
    const sym  = cfg.currency_emoji || '€';
    const user = db.getUser(userId, interaction.guildId);
    const maxLoan = Math.min(
      Math.floor((user.balance + user.bank) * LOAN_MAX_RATIO),
      LOAN_MAX_ABS
    );
    const modal = new ModalBuilder()
      .setCustomId(`banque_pret_modal_${userId}`)
      .setTitle('💳 Demande de prêt');
    const input = new TextInputBuilder()
      .setCustomId('montant')
      .setLabel(`Montant (max: ${maxLoan.toLocaleString('fr-FR')} ${sym})`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`ex: ${Math.floor(maxLoan / 2).toLocaleString('fr-FR')} ou max`)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  // ── Bouton Rembourser ─────────────────────────────────────────────────────
  if (cid.startsWith('banque_rem_')) {
    return doRepay(interaction);
  }

  // ── Bouton Actualiser ─────────────────────────────────────────────────────
  if (cid.startsWith('banque_ref_')) {
    await interaction.deferUpdate().catch(() => {});
    const cfg   = db.getConfig(interaction.guildId);
    cfg._guildId = interaction.guildId;
    const user  = db.getUser(userId, interaction.guildId);
    const rank  = db.db.prepare(
      'SELECT COUNT(*) as r FROM users WHERE guild_id=? AND (balance+bank)>?'
    ).get(interaction.guildId, user.balance + user.bank).r + 1;
    const total = db.db.prepare(
      'SELECT COUNT(*) as c FROM users WHERE guild_id=? AND (balance+bank)>0'
    ).get(interaction.guildId).c;
    const loan  = getActiveLoan(userId, interaction.guildId);
    const embed = buildBalanceEmbed(user, cfg, interaction.user, rank, total);
    const row   = buildButtons(userId, !!loan);
    return interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
  }
}

// ── Module export ─────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banque')
    .setDescription('🏦 Gère ta banque — solde, dépôt, retrait, prêt')
    .addSubcommand(sub => sub
      .setName('solde')
      .setDescription('Voir ton solde + boutons d\'action')
      .addUserOption(o => o.setName('membre').setDescription('Voir le solde d\'un autre').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('deposer')
      .setDescription('Déposer des € en banque (protégés du vol)')
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à déposer').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub
      .setName('retirer')
      .setDescription('Retirer des € de ta banque')
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à retirer').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub
      .setName('pret')
      .setDescription('Emprunter des € (15% d\'intérêts, 48h max)')
      .addStringOption(o => o.setName('montant').setDescription('Montant ou "max"').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('rembourser')
      .setDescription('Rembourser ton prêt en cours')),

  category: 'economy',
  handleComponent,

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();

      if (sub === 'solde') {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: false }).catch(() => {});
        }
        const target = interaction.options.getUser('membre') || interaction.user;
        return showSolde(interaction, target);
      }

      if (sub === 'deposer') {
        return doDeposit(interaction, interaction.options.getInteger('montant'));
      }

      if (sub === 'retirer') {
        return doWithdraw(interaction, interaction.options.getInteger('montant'));
      }

      if (sub === 'pret') {
        return doLoan(interaction, interaction.options.getString('montant').toLowerCase());
      }

      if (sub === 'rembourser') {
        return doRepay(interaction);
      }

    } catch (err) {
      console.error('[BANQUE] Erreur:', err?.message || err);
      const msg = { content: `❌ Erreur : ${String(err?.message || 'Inconnue').slice(0, 200)}`, ephemeral: true };
      try {
        if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
        else await interaction.reply(msg).catch(() => {});
      } catch {}
    }
  },
};
