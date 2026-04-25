'use strict';
const slashCmd = require('../../commands_guild/games/baccarat.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'baccarat',
  aliases: [],
  description: 'Execute the baccarat command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};