'use strict';
const slashCmd = require('../../commands_guild/unique/histoire.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'histoire',
  aliases: [],
  description: 'Execute the histoire command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};