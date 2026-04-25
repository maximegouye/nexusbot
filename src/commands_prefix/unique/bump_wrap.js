'use strict';
const slashCmd = require('../../commands/unique/bump.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'bump',
  aliases: [],
  description: 'Execute the bump command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};