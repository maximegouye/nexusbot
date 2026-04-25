'use strict';
const slashCmd = require('../../commands_guild/social/clans.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'clan',
  aliases: [],
  description: 'Execute the clan command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};