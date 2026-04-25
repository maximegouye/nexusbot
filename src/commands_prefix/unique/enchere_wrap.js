'use strict';
const slashCmd = require('../../commands_guild/unique/encheres.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'enchere',
  aliases: [],
  description: 'Execute the enchere command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};