'use strict';
const slashCmd = require('../../commands_guild/unique/syndicat.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'guilde',
  aliases: [],
  description: 'Execute the guilde command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};