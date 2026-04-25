'use strict';

/**
 * Crée un faux objet `interaction` à partir d'un `message` Discord.js + `args` array
 * pour pouvoir appeler les `execute()` des slash commands directement.
 */
class MessageInteractionAdapter {
  constructor(message, args = [], cmdData = {}) {
    this.message = message;
    this.args = args || [];
    this.cmdData = cmdData || {};
    
    // Propriétés d'interaction
    this.user = message.author;
    this.member = message.member;
    this.guild = message.guild;
    this.guildId = message.guildId;
    this.channel = message.channel;
    this.client = message.client;
    
    // État de réponse
    this.deferred = false;
    this.replied = false;
    this._deferredMessage = null;
    this._repliedMessage = null;
    
    // Nom de la commande
    this.commandName = cmdData.name || '';
    
    // Indexe des options
    this._optionIndex = 0;
    this._parseOptions();
  }

  /**
   * Parse les options du SlashCommandBuilder et mappe les args
   */
  _parseOptions() {
    if (!this.cmdData.options || !Array.isArray(this.cmdData.options)) {
      return;
    }

    // Vérifier s'il y a des subcommands
    const hasSubcommand = this.cmdData.options.some(
      opt => opt.type === 1 || opt.type === 2 // SlashCommandSubcommand(Group) = 1,2
    );

    if (hasSubcommand && this.args.length > 0) {
      // Le premier arg est potentiellement un subcommand
      const firstArg = this.args[0].toLowerCase();
      const subcommand = this.cmdData.options.find(
        opt => (opt.type === 1 || opt.type === 2) && opt.name === firstArg
      );

      if (subcommand) {
        this._subcommand = firstArg;
        this._optionIndex = 1; // Décaler les args
        this._subcommandOptions = subcommand.options || [];
      }
    }
  }

  /**
   * Récupère un subcommand si présent
   */
  getSubcommand(required = true) {
    if (!this._subcommand) {
      if (required) throw new Error('No subcommand provided');
      return null;
    }
    return this._subcommand;
  }

  /**
   * Récupère une string par nom ou index
   */
  getString(name, required = false) {
    const value = this._getArgByName(name);
    if (!value && required) {
      throw new Error(`Required string argument '${name}' not provided`);
    }
    return value || null;
  }

  /**
   * Récupère un integer par nom ou index
   */
  getInteger(name, required = false) {
    const value = this._getArgByName(name);
    if (!value && required) {
      throw new Error(`Required integer argument '${name}' not provided`);
    }
    if (!value) return null;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Récupère un number (float) par nom ou index
   */
  getNumber(name, required = false) {
    const value = this._getArgByName(name);
    if (!value && required) {
      throw new Error(`Required number argument '${name}' not provided`);
    }
    if (!value) return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Récupère un boolean par nom ou index
   */
  getBoolean(name, required = false) {
    const value = this._getArgByName(name);
    if (!value && required) {
      throw new Error(`Required boolean argument '${name}' not provided`);
    }
    if (!value) return null;
    return (
      value === 'true' ||
      value === '1' ||
      value === 'oui' ||
      value === 'yes' ||
      value === 'vrai'
    );
  }

  /**
   * Récupère un User par mention ou nom
   */
  async getUser(name, required = false) {
    const value = this._getArgByName(name);
    if (!value) {
      if (required) throw new Error(`Required user argument '${name}' not provided`);
      return null;
    }

    // Parse mention <@!ID> ou <@ID>
    const match = value.match(/^<@!?(\d+)>$/);
    if (match) {
      try {
        return await this.client.users.fetch(match[1]);
      } catch (e) {
        return null;
      }
    }

    // Chercher par nom dans le guild
    if (this.guild) {
      const members = await this.guild.members.search({ query: value, limit: 1 });
      if (members.size > 0) {
        return members.first().user;
      }
    }

    return null;
  }

  /**
   * Récupère un Member par mention ou nom
   */
  async getMember(name, required = false) {
    const value = this._getArgByName(name);
    if (!value) {
      if (required) throw new Error(`Required member argument '${name}' not provided`);
      return null;
    }

    if (!this.guild) return null;

    // Parse mention <@!ID> ou <@ID>
    const match = value.match(/^<@!?(\d+)>$/);
    if (match) {
      try {
        return await this.guild.members.fetch(match[1]);
      } catch (e) {
        return null;
      }
    }

    // Chercher par nom dans le guild
    const members = await this.guild.members.search({ query: value, limit: 1 });
    if (members.size > 0) {
      return members.first();
    }

    return null;
  }

  /**
   * Récupère un Channel par mention ou ID
   */
  getChannel(name, required = false) {
    const value = this._getArgByName(name);
    if (!value) {
      if (required) throw new Error(`Required channel argument '${name}' not provided`);
      return null;
    }

    // Parse mention <#ID>
    const match = value.match(/^<#(\d+)>$/);
    if (match) {
      return this.guild?.channels.cache.get(match[1]) || null;
    }

    // Chercher par ID direct
    return this.guild?.channels.cache.get(value) || null;
  }

  /**
   * Récupère une Role par mention ou ID
   */
  getRole(name, required = false) {
    const value = this._getArgByName(name);
    if (!value) {
      if (required) throw new Error(`Required role argument '${name}' not provided`);
      return null;
    }

    if (!this.guild) return null;

    // Parse mention <@&ID>
    const match = value.match(/^<@&(\d+)>$/);
    if (match) {
      return this.guild.roles.cache.get(match[1]) || null;
    }

    // Chercher par ID direct
    return this.guild.roles.cache.get(value) || null;
  }

  /**
   * Récupère un objet générique avec { value: ... }
   */
  get(name) {
    const value = this._getArgByName(name);
    return value ? { value } : null;
  }

  /**
   * Trouve l'argument par nom ou index
   */
  _getArgByName(name) {
    // Chercher dans cmdData.options
    if (this.cmdData.options && Array.isArray(this.cmdData.options)) {
      const options = this._subcommandOptions || this.cmdData.options;
      const optIndex = options.findIndex(opt => opt.name === name);
      if (optIndex !== -1) {
        const argIndex = this._optionIndex + optIndex;
        return this.args[argIndex] || null;
      }
    }

    // Fallback: utiliser l'index séquentiel
    const idx = this._optionIndex;
    return this.args[idx] || null;
  }

  /**
   * Defer la réponse
   */
  async deferReply(options = {}) {
    try {
      await this.message.channel.sendTyping();
      this.deferred = true;
      return { delete: async () => {} };
    } catch (e) {
      console.error('deferReply error:', e);
      return { delete: async () => {} };
    }
  }

  /**
   * Répond au message
   */
  async reply(data) {
    try {
      this._repliedMessage = await this.message.reply(data);
      this.replied = true;
      return {
        ...this._repliedMessage,
        delete: async () => {
          try {
            await this._repliedMessage?.delete();
          } catch (e) {}
        }
      };
    } catch (e) {
      console.error('reply error:', e);
      return {
        delete: async () => {}
      };
    }
  }

  /**
   * Édite la réponse déferrée ou la réponse existante
   */
  async editReply(data) {
    try {
      if (this.deferred && this._deferredMessage) {
        return await this._deferredMessage.edit(data);
      } else if (this._repliedMessage) {
        return await this._repliedMessage.edit(data);
      } else {
        return await this.message.channel.send(data);
      }
    } catch (e) {
      console.error('editReply error:', e);
      return null;
    }
  }

  /**
   * Envoie un message de suivi dans le channel
   */
  async followUp(data) {
    try {
      return await this.message.channel.send(data);
    } catch (e) {
      console.error('followUp error:', e);
      return null;
    }
  }
}

/**
 * Fonction utilitaire pour créer rapidement un adaptateur
 */
function adapt(message, args = [], cmdData = {}) {
  return new MessageInteractionAdapter(message, args, cmdData);
}

module.exports = {
  MessageInteractionAdapter,
  adapt
};
