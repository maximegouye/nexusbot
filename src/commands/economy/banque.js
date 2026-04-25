/**
 * /banque — Gestion unifiée de la banque avec boutons interactifs.
 * Mise ILLIMITÉE, pas de max.
 */
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../database/db');
const ef = require('../../utils/embedFactory');

function buildEmbed(user, cfg) {
  const symbol = cfg.currency_emoji || '€';
  const interestRate = cfg.bank_interest_rate ?? 0;
  const maxDeposit   = cfg.bank_max_deposit ?? -1;
  const total = (user.balance || 0) + (user.bank || 0);

  return ef.money('🏦 Ta banque NexusBot', [
    `👛 **Liquide :** ${(user.balance || 0).toLocaleString('fr-FR')}${symbol}`,
    `🏦 **Banque :** ${(user.bank || 0).toLocaleString('fr-FR')}${symbol}`,
    `💎 **Total :** ${total.toLocaleString('fr-FR')}${symbol}`,
    '',
    `📊 **Taux intérêt :** ${interestRate}%/jour`,
    `💰 **Dépôt max :** ${maxDeposit === -1 ? '∞ (illimité)' : maxDeposit.toLocaleString('fr-FR') + symbol}`,
    '',
    '_Utilise les boutons ci-dessous pour gérer tes finances._',
  ], { footer: '🏦 NexusBot Banque · mise ILLIMITÉE' });
}

function buildButtons(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`banque_dep:${userId}`).setLabel('🟢 Déposer').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`banque_ret:${userId}`).setLabel('🔴 Retirer').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`banque_depall:${userId}`).setLabel('⏫ Tout déposer').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`banque_retall:${userId}`).setLabel('⏬ Tout retirer').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`banque_refresh:${userId}`).setLabel('🔄 Actualiser').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`banque_crypto:${userId}`).setLabel('💹 Mon crypto').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`banque_history:${userId}`).setLabel('📜 Historique').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banque')
    .setDescription('🏦 Ta banque NexusBot — dépôt, retrait, intérêts · mise illimitée'),
  cooldown: 3,

  async execute(interaction) {
    const cfg  = db.getConfig(interaction.guildId);
    const user = db.getUser(interaction.user.id, interaction.guildId);
    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [buildEmbed(user, cfg)], components: buildButtons(interaction.user.id) });
  },


  async handleComponent(interaction, cid) {
    if (!cid.startsWith('banque_')) return false;
    const parts   = cid.split(':');
    const action  = parts[0];
    const ownerId = parts[1];

    // Vérif propriétaire
    if (interaction.user.id !== ownerId)
      return interaction.reply({ content: '❌ Ce n\'est pas ta banque !', ephemeral: true });

    const cfg  = db.getConfig(interaction.guildId);
    const user = db.getUser(ownerId, interaction.guildId);

    // Actualiser
    if (action === 'banque_refresh') {
      await interaction.update({ embeds: [buildEmbed(user, cfg)], components: buildButtons(ownerId) });
      return true;
    }

    // Tout déposer
    if (action === 'banque_depall') {
      const bal = user.balance || 0;
      if (bal <= 0) { await interaction.reply({ content: '❌ Pas d\'argent liquide à déposer.', ephemeral: true }); return true; }
      const max = cfg.bank_max_deposit ?? -1;
      let amount = bal;
      if (max > 0 && (user.bank + amount) > max) amount = max - (user.bank || 0);
      if (amount <= 0) { await interaction.reply({ content: '❌ Ta banque est pleine !', ephemeral: true }); return true; }
      db.db.prepare('UPDATE users SET balance=balance-?,bank=bank+? WHERE user_id=? AND guild_id=?').run(amount, amount, ownerId, interaction.guildId);
      const u = db.getUser(ownerId, interaction.guildId);
      await interaction.update({ embeds: [buildEmbed(u, cfg)], components: buildButtons(ownerId) });
      return true;
    }

    // Tout retirer
    if (action === 'banque_retall') {
      const bnk = user.bank || 0;
      if (bnk <= 0) { await interaction.reply({ content: '❌ Ta banque est vide.', ephemeral: true }); return true; }
      db.db.prepare('UPDATE users SET balance=balance+?,bank=bank-? WHERE user_id=? AND guild_id=?').run(bnk, bnk, ownerId, interaction.guildId);
      const u = db.getUser(ownerId, interaction.guildId);
      await interaction.update({ embeds: [buildEmbed(u, cfg)], components: buildButtons(ownerId) });
      return true;
    }

    // Déposer / Retirer via modal
    if (action === 'banque_dep' || action === 'banque_ret') {
      const isDeposit = action === 'banque_dep';
      const modal = new ModalBuilder()
        .setCustomId(`banque_modal_${isDeposit ? 'dep' : 'ret'}:${ownerId}`)
        .setTitle(isDeposit ? '💰 Déposer à la banque' : '🏧 Retirer de la banque')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('montant')
              .setLabel(isDeposit ? 'Montant à déposer (ex: 500 ou tout)' : 'Montant à retirer (ex: 500 ou tout)')
              .setStyle(1).setRequired(true).setPlaceholder('tout')
          )
        );
      await interaction.showModal(modal);
      return true;
    }

    // Modal soumis
    if (action === 'banque_modal_dep' || action === 'banque_modal_ret') {
      const isDeposit = action === 'banque_modal_dep';
      const raw = interaction.fields.getTextInputValue('montant').trim().toLowerCase();
      const bal = user.balance || 0;
      const bnk = user.bank    || 0;
      let amount;
      if (raw === 'tout' || raw === 'all') {
        amount = isDeposit ? bal : bnk;
      } else {
        amount = Math.floor(parseFloat(raw.replace(/[^0-9.]/g, '')));
      }
      if (!amount || amount <= 0) { await interaction.reply({ content: '❌ Montant invalide.', ephemeral: true }); return true; }
      if (isDeposit) {
        if (amount > bal) { await interaction.reply({ content: `❌ Tu n\'as que **${bal.toLocaleString('fr-FR')}** en liquide.`, ephemeral: true }); return true; }
        const max = cfg.bank_max_deposit ?? -1;
        if (max > 0 && bnk + amount > max) { await interaction.reply({ content: `❌ Limite bancaire dépassée (max ${max.toLocaleString('fr-FR')}).`, ephemeral: true }); return true; }
        db.db.prepare('UPDATE users SET balance=balance-?,bank=bank+? WHERE user_id=? AND guild_id=?').run(amount, amount, ownerId, interaction.guildId);
      } else {
        if (amount > bnk) { await interaction.reply({ content: `❌ Tu n\'as que **${bnk.toLocaleString('fr-FR')}** en banque.`, ephemeral: true }); return true; }
        db.db.prepare('UPDATE users SET balance=balance+?,bank=bank-? WHERE user_id=? AND guild_id=?').run(amount, amount, ownerId, interaction.guildId);
      }
      const u = db.getUser(ownerId, interaction.guildId);
      const sym = cfg.currency_emoji || '€';
      await interaction.reply({ content: `✅ **${amount.toLocaleString('fr-FR')}${sym}** ${isDeposit ? 'déposés en banque' : 'retirés de la banque'} !`, ephemeral: true });
      return true;
    }

    // Redirections
    if (action === 'banque_crypto')   { await interaction.reply({ content: '💹 Utilise `/crypto` pour voir ton portefeuille.', ephemeral: true }); return true; }
    if (action === 'banque_history')  { await interaction.reply({ content: '📜 Utilise `/historique` pour voir tes transactions.', ephemeral: true }); return true; }

    return false;
  },
  _build: { buildEmbed, buildButtons },
};
