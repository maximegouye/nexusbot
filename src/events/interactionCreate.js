'use strict';

// Routes des composants (boutons, menus, modals) vers la commande handler
const COMPONENT_ROUTES = {
  // ── handleComponent implémenté ───────────────────────────
  'part_':      'partenariat',
  'ticket_':    'ticket',
  'giveaway_':  'giveaway',
  'hist_':      'historique',
  'help_':      'aide',
  'profil_':    'profil',
  'prestige_':  'prestige',
  'roue_':      'roue',
  'pet_':       'pets',
  'rr_':        'reactionroles',
  'rolemenu_':  'rolemenu',
  'app_':       'applications',
  'apply_':     'applications',
  'appmodal_':  'applications',
  'sondage_':   'sondage_avance',
  'pendu_':     'pendu',
  'morpion_':   'morpion',
  'poll_':      'poll',
  // ── Collector-based (inline collector gère, pas execute) ─
  'crash_':     'crash',
  'mines_':     'mines',
  'slot_':      'slots',
  'poker_':     'poker',
  'heist_':     'braquage',
  'pay_':       'payer',
};

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

    // — Context Menus (clic-droit user/message) ─────────────
    if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return;
      try {
        await cmd.execute(interaction);
      } catch (e) {
        console.error(`[ContextMenu ${interaction.commandName}]`, e?.message || e);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `❌ Erreur lors de l'exécution.`, ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // — Boutons / Menus / Modals
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      const cid = interaction.customId || '';

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
          // Essayer handleComponent en premier (boutons/selects)
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
          }
          // Components are handled only via handleComponent; no execute() fallback for buttons/selects/modals
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
