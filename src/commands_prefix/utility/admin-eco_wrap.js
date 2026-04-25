'use strict';
const slashCmd = require('../../commands_guild/utility/admin.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'admin-eco',
  aliases: [],
  description: 'Execute the admin-eco command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};