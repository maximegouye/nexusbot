'use strict';
const slashCmd = require('../../commands_guild/admin/econ_admin.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'econ-admin',
  aliases: [],
  description: 'Execute the econ-admin command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};