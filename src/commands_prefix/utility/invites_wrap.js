'use strict';
const slashCmd = require('../../commands/utility/invites.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'invites',
  aliases: [],
  description: 'Execute the invites command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};