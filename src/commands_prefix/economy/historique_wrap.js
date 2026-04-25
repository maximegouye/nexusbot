'use strict';
const slashCmd = require('../../commands/economy/historique.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'historique',
  aliases: [],
  description: 'Execute the historique command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};