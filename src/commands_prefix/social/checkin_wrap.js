'use strict';
const slashCmd = require('../../commands_guild/social/checkin.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'checkin',
  aliases: [],
  description: 'Execute the checkin command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};