'use strict';
const slashCmd = require('../../commands/leveling/leaderboard.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'leaderboard',
  aliases: [],
  description: 'Execute the leaderboard command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};