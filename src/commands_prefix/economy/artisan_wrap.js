'use strict';
const slashCmd = require('../../commands_guild/economy/artisan.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'artisan',
  aliases: [],
  description: 'Execute the artisan command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};