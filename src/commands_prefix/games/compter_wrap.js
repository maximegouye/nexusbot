'use strict';
const slashCmd = require('../../commands/games/compter.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'compter',
  aliases: [],
  description: 'Execute the compter command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};