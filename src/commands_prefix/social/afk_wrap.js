'use strict';
const slashCmd = require('../../commands/social/afk.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'afk',
  aliases: [],
  description: 'Execute the afk command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};