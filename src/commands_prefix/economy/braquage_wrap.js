'use strict';
const slashCmd = require('../../commands_guild/economy/heist.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'braquage',
  aliases: [],
  description: 'Execute the braquage command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};