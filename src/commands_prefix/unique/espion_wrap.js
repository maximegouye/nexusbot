'use strict';
const slashCmd = require('../../commands_guild/unique/espionnage.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'espion',
  aliases: [],
  description: 'Execute the espion command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};