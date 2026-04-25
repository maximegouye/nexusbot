'use strict';
const slashCmd = require('../../commands_guild/admin/admin.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'admin',
  aliases: [],
  description: 'Execute the admin command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};