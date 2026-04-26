'use strict';

const db     = require('../database/db');

// Routes des composants (boutons, menus, modals) vers la commande handler
const COMPONENT_ROUTES = {
  // ── Commandes avec handleComponent ───────────────────────
  'part_':        'partenariat',
  'ticket_':      'ticket',
  'giveaway_':    'giveaway',
  // ── Nouvelles routes avec handleComponent ────────────────
  'banque_':      'banque',
  'hist_':        'historique',
  'help_':        'aide',
  'profil_':      'profil',
  // ── Jeux/eco avec handleComponent ou re-dispatch ─────────
  'casino_':      'casino',
  'blackjack_':   'blackjack',
  'crash_':       'crash',
  'mines_':       'mines',
  'poker_':       'poker',
  'slot_':        'slots',
  'roulette_':    'roulette',
  'rob_':         'rob',
  'fish_':        'fish',
  'quest_':       'quest',
  'suggest_':     'suggestion',
  'voice_':       'tempvoice',
  'conf_':        'confession',
  'rep_':         'rep',
  'bump_':        'bump',
  // ── Routes sans collector (handleComponent requis) ────────
  'prestige_':    'prestige',
  'roue_':        'roue',
  'pet_':         'pets',
  'rr_':          'reactionroles',
  'rolemenu_':    'rolemenu',
  // ── Autres composants ────────────────────────────────────
  'app_':         'applications',
  'apply_':       'applications',
  'rec_':         'recrutement',
  'pay_'          : 'payer',
  'heist_'        : 'braquage',
  'sondage_'      : 'sondage_avance',
  'pendu_'        : 'pendu',
  'morpion_'      : 'morpion',
  'poll_'         : 'poll',
  'appmodal_':    'applications',
  // ── Nouveaux jeux de casino ──────────────────────────────
  'grattage_':    'grattage',
  'tour_':        'tour',
  // ── Préfixes alternatifs jeux (replay persistent) ────────
  'rl_':          'roulette',   // replay roulette
  'plinko_':      'plinko',
  'des_':         'des',
  'rf_':          'roue-fortune',
  'baccarat_':    'baccarat',
  'vp_':          'videopoker',
  'hilo_':        'hilo',
  'hippo_':       'hippodrome',
  'slots_':       'slots',
  'bj_':          'blackjack',
  'crypto_':       'crypto',
  'tournoi_':      'tournoi',
};

// Prefixes du panneau de configuration (cfg: / cfg_ et adv: / adv_)
const CFG_PREFIXES = ['cfg:', 'cfg_chan:', 'cfg_role:', 'cfg_modal:'];
const ADV_PREFIXES = ['adv:', 'adv_modal:', 'adv_chan:', 'adv_role:', 'adv_sel:'];

function isCfgInteraction(cid) { return CFG_PREFIXES.some(p => cid.startsWith(p)); }
function isAdvInteraction(cid) { return ADV_PREFIXES.some(p => cid.startsWith(p)); }

// Vérifie si l'interaction est un composant quelconque (bouton, menu, modal)
function isAnyComponent(i) {
  return i.isButton()
    || i.isStringSelectMenu()
    || i.isChannelSelectMenu()
    || i.isRoleSelectMenu()
    || i.isUserSelectMenu()
    || i.isMentionableSelectMenu()
    || i.isModalSubmit();
}

module.exports = {
  name: 'interactionCreate',

  async execute(interaction, client) {

    // ── Slash Commands ────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({ content: 'Commande inconnue.', ephemeral: true }).catch(() => {});
      }
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`[SLASH /${interaction.commandName}] Erreur:`, error?.message || error);
        const errMsg = { content: "Une erreur est survenue lors de l'execution.", ephemeral: true };
        try {
          if (interaction.deferred || interaction.replied) await interaction.followUp(errMsg);
          else await interaction.reply(errMsg);
        } catch (_) {}
      }
      return;
    }

    // ── Autocomplete ──────────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete) {
        try { await command.autocomplete(interaction); } catch (_) {}
      }
      return;
    }

    // ── Composants (boutons, menus, modals, channel/role selects) ─────────────
    if (!isAnyComponent(interaction)) return;

    const cid = interaction.customId || '';

    // ── PANNEAU DE CONFIGURATION BASE (cfg: / cfg_chan: / cfg_role: / cfg_modal:)
    if (isCfgInteraction(cid)) {
      try {
        const { handleConfigInteraction } = require('../utils/configPanel');
        const handled = await handleConfigInteraction(interaction, db, client);
        if (handled) return;
      } catch (e) {
        console.error('[CONFIG-PANEL] Erreur:', e?.message || e);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `❌ Erreur config: ${e?.message || e}`, ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // ── PANNEAU DE CONFIGURATION AVANCÉ (adv: / adv_modal: / adv_chan: / adv_role: / adv_sel:)
    if (isAdvInteraction(cid)) {
      try {
        const { handleAdvancedInteraction } = require('../utils/configPanelAdvanced');
        const handled = await handleAdvancedInteraction(interaction, db, client);
        if (handled) return;
      } catch (e) {
        console.error('[ADV-PANEL] Erreur:', e?.message || e);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `❌ Erreur config avancée: ${e?.message || e}`, ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // ── Routing general via COMPONENT_ROUTES ──────────────────────────────────
    let handler = null;
    for (const [prefix, cmdName] of Object.entries(COMPONENT_ROUTES)) {
      if (cid.startsWith(prefix)) {
        handler = client.commands.get(cmdName);
        break;
      }
    }

    // Fallback: extraire le nom de commande du customId (format: cmd_action:...)
    if (!handler) {
      const firstPart = cid.split('_')[0].split('-')[0].toLowerCase();
      handler = client.commands.get(firstPart);
    }

    // Dernier recours: parcourir toutes les commandes avec handleComponent
    if (!handler) {
      for (const [, cmd] of client.commands) {
        if (typeof cmd.handleComponent === 'function') {
          try {
            const handled = await cmd.handleComponent(interaction, cid);
            if (handled) return;
          } catch (_) {}
        }
      }
      // Pas de handler trouvé — interaction non gérée, on ignore silencieusement
      return;
    }

    // Handler trouvé
    try {
      if (typeof handler.handleComponent === 'function') {
        try {
          const handled = await handler.handleComponent(interaction, cid);
          if (handled) return;
        } catch (hcErr) {
          console.error(`[COMPONENT ${cid}] handleComponent crash:`, hcErr?.message || hcErr);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: `❌ Erreur: ${hcErr?.message || 'Erreur inconnue'}`, ephemeral: true }).catch(() => {});
          } else if (interaction.deferred) {
            await interaction.editReply({ content: `❌ Erreur: ${hcErr?.message || 'Erreur inconnue'}` }).catch(() => {});
          }
          return;
        }
      } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
        // Pas de handleComponent → collector expiré ou bouton orphelin
        await interaction.reply({ content: '⏱️ Cette interaction a expiré. Relancez la commande.', ephemeral: true }).catch(() => {});
        return;
      }
      // Modal sans handleComponent → execute()
      await handler.execute(interaction);
    } catch (e) {
      console.error(`[COMPONENT ${cid}] Erreur:`, e?.message || e);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erreur composant.', ephemeral: true }).catch(() => {});
      }
    }
  },
};
