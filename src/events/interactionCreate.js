'use strict';

// Routes des composants (boutons, menus, modals) vers la commande handler
const COMPONENT_ROUTES = {
  'part_':       'partenariat',
  'travail_job_':'travail',
  'casino_':     'casino',
  'blackjack_':  'blackjack',
  'crash_':      'crash',
  'mines_':      'mines',
  'poker_':      'poker',
  'slot_':       'slots',
  'roulette_':   'roulette',
  'rob_':        'rob',
  'fish_':       'fish',
  'quest_':      'quest',
  'ticket_':     'ticket',
  'giveaway_':   'giveaway',
  'suggest_':    'suggestion',
  'voice_':      'tempvoice',
  'conf_':       'confession',
  'rep_':        'rep',
  'bump_':       'bump',
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
            await interaction.editReply(errMsg);
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

    // -- Boutons / Menus / Modals
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
              }
          }
          await handler.execute(interaction);
        } catch (e) {
          console.error(`[COMPONENT ${cid}] Erreur:`, e?.message || e);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Erreur composant.', ephemeral: true }).catch(() => {});
          }
        }
      }
      return;
    }
  },
};
