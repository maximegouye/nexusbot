'use strict';
const slashCmd = require('../../commands_guild/economy/boutique.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'boutique',
  aliases: [],
  description: 'Execute the boutique command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};