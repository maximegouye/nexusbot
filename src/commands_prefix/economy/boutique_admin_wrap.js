'use strict';
const slashCmd = require('../../commands_guild/economy/boutique_admin.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'boutique_admin',
  aliases: [],
  description: 'Execute the boutique_admin command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};