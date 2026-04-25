'use strict';
const slashCmd = require('../../commands/unique/anniversaire.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'anniversaire',
  aliases: [],
  description: 'Execute the anniversaire command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};