'use strict';

const db = require('../database/db');

// Routes des composants (boutons, menus, modals) vers la commande handler
const COMPONENT_ROUTES = {
  // ── Commandes avec handleComponent ───────────────────────
  'part_':        'partenariat',
  'ticket_':      'ticket',
  'giveaway_':    'giveaway',
  // ── Nouvelles routes avec handleComponent ────────────────
  'hist_':        'historique',
  'help_':        'aide',
  'profil_':      'profil',
  // ── Jeux/eco avec handleComponent ─────────────────────────
  'casino_':      'casino',
  'crash_':       'crash',
  'mines_':       'mines',
  'roue_':        'roue',
  // ── Routes sans collector (handleComponent requis) ────────
  'prestige_':    'prestige',
  'pet_':         'pet',
  'rr_':          'reactionroles',
  'rolemenu_':    'rolemenu',
  // ── Autres composants avec handleComponent ─────────────────
  'apply_':       'candidature',
  'rec_':         'recrutement',
  'pendu_':       'pendu',
  'poll_':        'poll',
  // ── Jeux de casino (replay persistent) ─────────────────────
  'grattage_':    'grattage',
  'tour_':        'tour',
  'plinko_':      'plinko',
  'des_':         'des',
  'rf_':          'roue-fortune',
  'baccarat_':    'baccarat',
  'vp_':          'videopoker',
  'hilo_':        'hilo',
  'hippo_':       'hippodrome',
  'slots_':       'slots',
  'cslot_':       'slots',   // Casino machine (casinoMachine.js buttons)
  'bj_':          'blackjack',
  'cs_':          'casino-stats',
  'keno_':        'keno',
  'rl_':          'roulette',   // replay roulette
  // ── Sondage avancé (handles persistent components) ────────
  'sondagev_':    'sondage-avance',
  // ── Jeux supplémentaires ──────────────────────────────────
  'morpion_':     'morpion',
};

// ── Préfixes du panneau /config ───────────────────────────
const CFG_PREFIXES = ['cfg:', 'cfg_chan:', 'cfg_role:', 'cfg_modal:'];
// ── Préfixes du panneau /config avancé ───────────────────
const ADV_PREFIXES = ['adv:', 'adv_modal:', 'adv_chan:', 'adv_role:', 'adv_sel:'];

function isCfgInteraction(cid) {
  return CFG_PREFIXES.some(p => cid.startsWith(p));
}
function isAdvInteraction(cid) {
  return ADV_PREFIXES.some(p => cid.startsWith(p));
}

// ── Détecte tout type de composant Discord ────────────────
function isAnyComponent(interaction) {
  return (
    interaction.isButton() ||
    interaction.isStringSelectMenu() ||
    interaction.isChannelSelectMenu() ||
    interaction.isRoleSelectMenu() ||
    interaction.isUserSelectMenu() ||
    interaction.isMentionableSelectMenu() ||
    interaction.isModalSubmit()
  );
}

module.exports = {
  name: 'interactionCreate',

  async execute(interaction, client) {

    // -- Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({ content: 'Commande inconnue.', ephemeral: true }).catch(() => {});
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`[SLASH /${interaction.commandName}] Erreur:`, error?.message || error);
        const errMsg = { content: 'Une erreur est survenue lors de l\'execution.', ephemeral: true };
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp(errMsg);
          } else {
            await interaction.reply(errMsg);
          }
        } catch (_) {}
      }
      return;
    }

    // -- Autocomplete
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete) {
        try { await command.autocomplete(interaction); } catch (_) {}
      }
      return;
    }

    // — Boutons / Menus / Modals (tous types)
    if (isAnyComponent(interaction)) {
      const cid = interaction.customId || '';

      // ── Quiz événements automatiques ──────────────────────
      if (cid.startsWith('quiz_event_')) {
        try {
          const { handleQuizButton } = require('../utils/autoEventWorker');
          await handleQuizButton(interaction);
        } catch (e) { console.error('[quiz_event]', e.message); }
        return;
      }

      // ── Vérification anti-bot ──────────────────────────────
      if (cid.startsWith('verify_human_')) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        const parts = cid.split('_');
        const guildId = parts[2];
        const targetUserId = parts[3];

        if (interaction.user.id !== targetUserId) {
          return interaction.editReply({ content: '❌ Ce bouton n\'est pas pour toi.' }).catch(() => {});
        }

        const cfg = db.getConfig(guildId);
        if (cfg.verification_role) {
          try {
            const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
            if (member) {
              await member.roles.remove(cfg.verification_role).catch(() => {});
              return interaction.editReply({ content: '✅ Vérification réussie ! Tu as maintenant accès au serveur. Bienvenue !' }).catch(() => {});
            }
          } catch {}
        }
        return interaction.editReply({ content: '✅ Vérifié !' }).catch(() => {});
      }

      // ── Panneau /config ────────────────────────────────────
      if (isCfgInteraction(cid)) {
        try {
          const { handleConfigInteraction } = require('../utils/configPanel');
          const dbHelpers = require('../database/db');
          const handled = await handleConfigInteraction(interaction, dbHelpers, client);
          if (handled) return;
        } catch (e) {
          console.error('[CFG] handleConfigInteraction crash:', e?.message || e);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erreur panneau config.', ephemeral: true }).catch(() => {});
          }
          return;
        }
      }

      // ── Panneau /config avancé ─────────────────────────────
      if (isAdvInteraction(cid)) {
        try {
          const { handleAdvancedInteraction } = require('../utils/configPanelAdvanced');
          const dbHelpers = require('../database/db');
          const handled = await handleAdvancedInteraction(interaction, dbHelpers, client);
          if (handled) return;
        } catch (e) {
          console.error('[ADV] handleAdvancedInteraction crash:', e?.message || e);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erreur panneau config avancé.', ephemeral: true }).catch(() => {});
          }
          return;
        }
      }

      let handler = null;
      for (const [prefix, cmdName] of Object.entries(COMPONENT_ROUTES)) {
        if (cid.startsWith(prefix)) {
          handler = client.commands.get(cmdName);
          break;
        }
      }

      if (!handler) {
        const firstPart = cid.split('_')[0].split('-')[0].toLowerCase();
        handler = client.commands.get(firstPart);
      }

      if (!handler) {
        for (const [, cmd] of client.commands) {
          if (typeof cmd.handleComponent === 'function') {
            try {
              const handled = await cmd.handleComponent(interaction, cid);
              if (handled) return;
            } catch (_) {}
          }
        }
      }

      if (handler) {
        try {
          // ── handleComponent en premier (boutons / menus / modals) ──────────
          if (typeof handler.handleComponent === 'function') {
            try {
              await handler.handleComponent(interaction, cid);
              // Toujours retourner après handleComponent — ne jamais appeler
              // execute() ensuite, sinon execute() s'exécute sur un bouton avec
              // des options null → double-traitement et affichage écrasé.
              return;
            } catch (hcErr) {
              console.error(`[COMPONENT ${cid}] handleComponent crash:`, hcErr?.message || hcErr);
              if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: `❌ Erreur: ${hcErr?.message || 'Erreur inconnue'}`, ephemeral: true }).catch(() => {});
              } else if (interaction.deferred) {
                await interaction.editReply({ content: `❌ Erreur: ${hcErr?.message || 'Erreur inconnue'}` }).catch(() => {});
              }
              return;
            }
          } else if (!interaction.isModalSubmit()) {
            // Bouton/menu sans handleComponent → collector expiré ou bouton orphelin
            await interaction.reply({ content: '⏱️ Cette interaction a expiré. Relancez la commande.', ephemeral: true }).catch(() => {});
            return;
          }
          // Modal sans handleComponent → laisser passer vers execute()
          await handler.execute(interaction);
        } catch (e) {
          console.error(`[COMPONENT ${cid}] Erreur:`, e?.message || e);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Erreur composant.', ephemeral: true }).catch(() => {});
          }
        }
        return;
      }
    }
  },
};
