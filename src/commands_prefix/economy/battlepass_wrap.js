'use strict';
const slashCmd = require('../../commands_guild/economy/battlepass.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'battlepass',
  aliases: [],
  description: 'Execute the battlepass command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};