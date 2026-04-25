'use strict';
const slashCmd = require('../../commands_guild/economy/evenements.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'evenement',
  aliases: [],
  description: 'Execute the evenement command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};