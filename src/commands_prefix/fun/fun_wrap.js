'use strict';
const slashCmd = require('../../commands/fun/fun.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'fun',
  aliases: [],
  description: 'Execute the fun command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};