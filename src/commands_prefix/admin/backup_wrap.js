'use strict';
const slashCmd = require('../../commands/admin/backup.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'backup',
  aliases: [],
  description: 'Execute the backup command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};