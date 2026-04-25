'use strict';
const slashCmd = require('../../commands_guild/unique/famille.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'famille',
  aliases: [],
  description: 'Execute the famille command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};