'use strict';
const slashCmd = require('../../commands/admin/lockserver.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'lockserver',
  aliases: [],
  description: 'Execute the lockserver command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};