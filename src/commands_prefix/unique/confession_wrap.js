'use strict';
const slashCmd = require('../../commands/unique/confession.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'confession',
  aliases: [],
  description: 'Execute the confession command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};