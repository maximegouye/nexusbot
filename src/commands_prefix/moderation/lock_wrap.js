'use strict';
const slashCmd = require('../../commands/moderation/lock.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'lock',
  aliases: [],
  description: 'Execute the lock command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};