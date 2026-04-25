'use strict';
const slashCmd = require('../../commands_guild/unique/giveaway.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'giveaway',
  aliases: [],
  description: 'Execute the giveaway command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};