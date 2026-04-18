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
    return interaction.reply({ embeds: [buildEmbed(user, cfg)], components: buildButtons(interaction.user.id) });
  },

  _build: { buildEmbed, buildButtons },
};
