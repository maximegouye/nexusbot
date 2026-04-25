'use strict';
const slashCmd = require('../../commands/economy/daily.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'daily',
  aliases: [],
  description: 'Execute the daily command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};