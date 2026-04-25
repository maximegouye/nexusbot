'use strict';
const slashCmd = require('../../commands/moderation/clearwarns.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'clearwarns',
  aliases: [],
  description: 'Execute the clearwarns command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};