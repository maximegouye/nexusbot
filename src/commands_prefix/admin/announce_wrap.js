'use strict';
const slashCmd = require('../../commands/admin/announce.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'announce',
  aliases: [],
  description: 'Execute the announce command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};