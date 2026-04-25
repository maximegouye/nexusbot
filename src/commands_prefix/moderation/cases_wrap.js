'use strict';
const slashCmd = require('../../commands/moderation/cases.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'cases',
  aliases: [],
  description: 'Execute the cases command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};