'use strict';
/**
 * casinoUtils.js — Utilitaires partagés pour tous les jeux casino NexusBot
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');

// ── Palette de couleurs ─────────────────────────────────────────────────────
const C = {
  WIN:     '#27AE60',
  JACKPOT: '#F1C40F',
  LOSS:    '#E74C3C',
  PUSH:    '#7F8C8D',
  NEUTRAL: '#2C3E50',
  SPIN: ['#C0392B','#E74C3C','#D35400','#E67E22','#F39C12','#F1C40F'],
};

// ── Jeton visuel selon montant ──────────────────────────────────────────────
function chipEmoji(amount) {
  if (amount >= 50000) return '💎';
  if (amount >= 10000) return '💜';
  if (amount >= 5000)  return '🔴';
  if (amount >= 1000)  return '🟣';
  if (amount >= 500)   return '🔵';
  if (amount >= 100)   return '🟢';
  if (amount >= 50)    return '🟡';
  return '⚪';
}

// ── Mise formatée avec jeton ─────────────────────────────────────────────────
function chipStr(amount, coin = '€') {
  return `${chipEmoji(amount)} **${Number(amount).toLocaleString('fr-FR')} ${coin}**`;
}

// ── Affichage bilan (solde + diff en couleur) ────────────────────────────────
function balanceLine(newBal, diff, coin = '€') {
  const sign = diff >= 0 ? '+' : '';
  const icon = diff > 0 ? '📈' : diff < 0 ? '📉' : '➖';
  return `${icon} **${Number(newBal).toLocaleString('fr-FR')} ${coin}** \`(${sign}${Number(diff).toLocaleString('fr-FR')})\``;
}

// ── Footer standard casino ────────────────────────────────────────────────────
function casinoFooter(gameName) {
  return `🎰 Casino NexusBot • ${gameName} • Jouez de manière responsable`;
}

// ── Rangée de boutons standard (Rejouer + Changer mise) ─────────────────────
function makeGameRow(prefix, userId, mise, extra = '') {
  const extraPart = extra ? `_${extra}` : '';
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}_replay_${userId}_${mise}${extraPart}`)
      .setLabel('🔄 Rejouer')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${prefix}_changemise_${userId}${extraPart}`)
      .setLabel('💰 Changer la mise')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ── Modal pour changer la mise ────────────────────────────────────────────────
function changeMiseModal(prefix, userId, extra = '') {
  const extraPart = extra ? `_${extra}` : '';
  return new ModalBuilder()
    .setCustomId(`${prefix}_modal_${userId}${extraPart}`)
    .setTitle('💰 Changer la mise')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('newmise')
          .setLabel('Nouvelle mise en € (min 5)')
          .setPlaceholder('Ex : 500 — ou "all" pour tout miser')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(12)
      )
    );
}

// ── Parsing de la mise (supporte "all", "half", "50%") ──────────────────────
function parseMise(raw, balance) {
  const s = String(raw).toLowerCase().trim();
  if (s === 'all' || s === 'tout' || s === 'max') return balance;
  if (s === 'half' || s === 'moitie' || s === '50%') return Math.floor(balance / 2);
  if (s.endsWith('%')) {
    const pct = parseFloat(s);
    return Math.floor(balance * Math.min(pct, 100) / 100);
  }
  const n = parseInt(s);
  return isNaN(n) ? null : n;
}

module.exports = { C, chipEmoji, chipStr, balanceLine, casinoFooter, makeGameRow, changeMiseModal, parseMise };
