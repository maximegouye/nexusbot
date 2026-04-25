'use strict';
const slashCmd = require('../../commands/games/connect4.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'connect4',
  aliases: [],
  description: 'Execute the connect4 command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};