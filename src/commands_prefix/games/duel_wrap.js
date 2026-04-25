'use strict';
const slashCmd = require('../../commands_guild/games/duel.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'duel',
  aliases: [],
  description: 'Execute the duel command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};