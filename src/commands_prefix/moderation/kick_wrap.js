'use strict';
const slashCmd = require('../../commands/moderation/kick.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'kick',
  aliases: [],
  description: 'Execute the kick command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};