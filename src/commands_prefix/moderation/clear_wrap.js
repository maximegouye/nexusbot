'use strict';
const slashCmd = require('../../commands/moderation/clear.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'clear',
  aliases: [],
  description: 'Execute the clear command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};