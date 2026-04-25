'use strict';
const slashCmd = require('../../commands/utility/customcmd.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'customcmd',
  aliases: [],
  description: 'Execute the customcmd command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};