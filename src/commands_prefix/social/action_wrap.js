'use strict';
const slashCmd = require('../../commands/social/actions.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'action',
  aliases: [],
  description: 'Execute the action command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};