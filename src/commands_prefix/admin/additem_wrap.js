'use strict';
const slashCmd = require('../../commands/admin/additem.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'additem',
  aliases: [],
  description: 'Execute the additem command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};