'use strict';
const slashCmd = require('../../commands_guild/unique/autorespond.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'autorespond',
  aliases: [],
  description: 'Execute the autorespond command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};