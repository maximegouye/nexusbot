'use strict';
const slashCmd = require('../../commands_guild/social/mood_tracker.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'humeur',
  aliases: [],
  description: 'Execute the humeur command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};