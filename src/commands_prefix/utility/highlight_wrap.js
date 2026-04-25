'use strict';
const slashCmd = require('../../commands/utility/highlight.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'highlight',
  aliases: [],
  description: 'Execute the highlight command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};