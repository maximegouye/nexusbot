'use strict';
const slashCmd = require('../../commands/economy/inventory.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'inventory',
  aliases: [],
  description: 'Execute the inventory command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};