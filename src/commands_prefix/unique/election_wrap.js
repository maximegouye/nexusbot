'use strict';
const slashCmd = require('../../commands_guild/unique/elections.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'election',
  aliases: [],
  description: 'Execute the election command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};