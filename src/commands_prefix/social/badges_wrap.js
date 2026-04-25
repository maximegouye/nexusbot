'use strict';
const slashCmd = require('../../commands_guild/social/badges.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'badges',
  aliases: [],
  description: 'Execute the badges command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};