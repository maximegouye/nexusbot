'use strict';
const slashCmd = require('../../commands_guild/economy/investissement.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'investir',
  aliases: [],
  description: 'Execute the investir command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};