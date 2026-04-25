'use strict';
const slashCmd = require('../../commands/admin/dehoist.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'dehoist',
  aliases: [],
  description: 'Execute the dehoist command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};