'use strict';
const slashCmd = require('../../commands_guild/economy/bourse.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'bourse',
  aliases: [],
  description: 'Execute the bourse command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};