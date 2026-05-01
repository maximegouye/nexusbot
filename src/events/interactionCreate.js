'use strict';

const db = require('../database/db');
const { withWatchdog, ensureAcked, logError } = require('../utils/interactionGuard');

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
  'rec_':         'recrutement',
  'reward_':      'recompenses',
  'pendu_':       'pendu',
  'poll_':        'poll',
  // ── Banque (dépôt/retrait/prêt boutons + modals) ──────────
  'banque_':      'banque',
  // ── Mega Slots VIP ─────────────────────────────────────────
  'ms_':          'mega-slots',
  // ── Jeux de casino (replay persistent) ─────────────────────
  'grattage_':    'grattage',
  // 'tour_' et 'des_' supprimés (fichiers .disabled)
  'plinko_':      'plinko',
  'rf_':          'roue-fortune',
  'baccarat_':    'baccarat',
  'vp_':          'videopoker',
  'hilo_':        'hilo',
  'hippo_':       'hippodrome',
  'slots_':       'slots',
  'cslot_':       'slots',   // Casino machine (casinoMachine.js buttons)
  'slotspro_':    'slots-pro',  // Slots Pro 6 machines thématiques
  'bj_':          'blackjack',
  'cs_':          'casino-stats',
  'keno_':        'keno',
  'rl_':          'roulette',   // replay roulette
  'cf_':          'coffre-magique', // coffre magique multi-niveaux
  // ── Sondage avancé (handles persistent components) ────────
  'sondagev_':    'sondage-avance',
  // ── Jeux supplémentaires ──────────────────────────────────
  'morpion_':     'morpion',
  'ttt_':         'tictactoe',
  'c4_':          'connect4',
  // ── Candidatures ──────────────────────────────────────────
  'apply_':       'candidature',
  'app_':         'candidature',
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
        return interaction.reply({ content: '❌ Commande inconnue.', ephemeral: true }).catch(() => {});
      }

      // ── Auto-defer SAUF si la commande ouvre un modal ────────
      // (showModal() interdit après deferReply)
      // Les commandes qui ouvrent un modal doivent exposer `opensModal: true`
      // OU `opensModal: (interaction) => bool` pour les cas par sous-commande.
      let willOpenModal = false;
      if (command.opensModal) {
        try {
          willOpenModal = typeof command.opensModal === 'function'
            ? !!command.opensModal(interaction)
            : !!command.opensModal;
        } catch (_) { willOpenModal = false; }
      }

      // Une commande peut déclarer `ephemeral: true` (booléen ou fn(interaction))
      // pour que l'auto-defer global respecte sa préférence d'ephémérité.
      let wantsEphemeral = false;
      if (command.ephemeral) {
        try {
          wantsEphemeral = typeof command.ephemeral === 'function'
            ? !!command.ephemeral(interaction)
            : !!command.ephemeral;
        } catch (_) { wantsEphemeral = false; }
      }

      if (!willOpenModal && !interaction.deferred && !interaction.replied) {
        try { await interaction.deferReply({ ephemeral: wantsEphemeral }); } catch (_) {}
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        const detail = (error?.message || String(error)).slice(0, 800);
        console.error(`[SLASH /${interaction.commandName}] Erreur:`, error?.stack || error);
        const errMsg = { content: `❌ Erreur \`/${interaction.commandName}\` : \`${detail}\`` };
        try {
          if (interaction.deferred || interaction.replied) await interaction.followUp({ ...errMsg, ephemeral: true });
          else await interaction.reply({ ...errMsg, ephemeral: true });
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
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ content: '❌ Erreur panneau config.', ephemeral: true }).catch(() => {});
          } else {
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
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ content: '❌ Erreur panneau config avancé.', ephemeral: true }).catch(() => {});
          } else {
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
        // ═══════════════════════════════════════════════════════════
        // 🛡️ V5 SIMPLE & ROBUSTE — pattern éprouvé
        // ═══════════════════════════════════════════════════════════
        // 1. Modal submits → auto-defer ephemeral (safe)
        // 2. Boutons/menus → laisser le handler gérer
        // 3. Try/catch propre, fallback graceful sur erreur
        // 4. Pas de magie Promise.race qui peut casser au boot
        try {
          if (interaction.isModalSubmit() && !interaction.deferred && !interaction.replied) {
            try { await interaction.deferReply({ ephemeral: true }); } catch (_) {}
          }

          if (typeof handler.handleComponent === 'function') {
            // Wrapper async pour catch sync errors aussi
            try {
              await handler.handleComponent(interaction, cid);
            } catch (hcErr) {
              console.error(`[COMPONENT ${cid}] crash:`, hcErr?.message || hcErr);
              // Fallback réponse
              try {
                if (!interaction.replied && !interaction.deferred) {
                  await interaction.reply({ content: `❌ Erreur: ${(hcErr?.message || 'Inconnue').slice(0, 200)}`, ephemeral: true });
                } else {
                  await interaction.followUp({ content: `❌ Erreur: ${(hcErr?.message || 'Inconnue').slice(0, 200)}`, ephemeral: true });
                }
              } catch {}
            }
            // Safety net : si rien n'a été ack, on défère silencieusement
            if (!interaction.replied && !interaction.deferred) {
              try {
                if (interaction.isButton?.() || interaction.isAnySelectMenu?.() || interaction.isStringSelectMenu?.()) {
                  await interaction.deferUpdate();
                } else if (interaction.isChatInputCommand?.()) {
                  await interaction.deferReply();
                }
              } catch {}
            }
            return;
          } else if (!interaction.isModalSubmit()) {
            const _respondExp = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
            await _respondExp({ content: '⏱️ Cette interaction a expiré. Relancez la commande.', ephemeral: true }).catch(() => {});
            return;
          }
          await handler.execute(interaction);
        } catch (e) {
          console.error(`[COMPONENT ${cid}] Erreur:`, e?.message || e);
          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: 'Erreur composant.', ephemeral: true });
            } else {
              await interaction.followUp({ content: 'Erreur composant.', ephemeral: true });
            }
          } catch {}
        }
        return;
      }
    }
  },
};
