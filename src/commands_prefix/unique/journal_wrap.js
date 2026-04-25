'use strict';
const slashCmd = require('../../commands_guild/unique/journal.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'journal',
  aliases: [],
  description: 'Execute the journal command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};