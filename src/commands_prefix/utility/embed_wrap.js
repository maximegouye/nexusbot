'use strict';
const slashCmd = require('../../commands/utility/embed.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'embed',
  aliases: [],
  description: 'Execute the embed command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};