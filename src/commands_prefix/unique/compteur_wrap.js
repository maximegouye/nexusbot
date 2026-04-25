'use strict';
const slashCmd = require('../../commands_guild/unique/compteur.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'compteur',
  aliases: [],
  description: 'Execute the compteur command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};