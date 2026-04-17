/**
 * NexusBot — Outils de manipulation de texte (prefix)
 * n!upper, n!lower, n!zalgo, n!encrypt, n!caesar, n!morse, n!binary...
 */
const { EmbedBuilder } = require('discord.js');

function caesar(text, shift) {
  return text.replace(/[a-zA-Z]/g, (c) => {
    const base = c >= 'a' ? 97 : 65;
    return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26) + base);
  });
}

function toMorse(text) {
  const map = {
    a:'.-', b:'-...', c:'-.-.', d:'-..', e:'.', f:'..-.', g:'--.',
    h:'....', i:'..', j:'.---', k:'-.-', l:'.-..', m:'--', n:'-.',
    o:'---', p:'.--.', q:'--.-', r:'.-.', s:'...', t:'-', u:'..-',
    v:'...-', w:'.--', x:'-..-', y:'-.--', z:'--..',
    '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-',
    '5':'.....','6':'-....','7':'--...','8':'---..','9':'----.',
  };
  return text.toLowerCase().split('').map(c => c === ' ' ? '/' : (map[c] || c)).join(' ');
}

function toBinary(text) {
  return text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
}

function toBase64(text) {
  return Buffer.from(text).toString('base64');
}

function fromBase64(text) {
  try { return Buffer.from(text, 'base64').toString('utf8'); }
  catch { return '❌ Base64 invalide'; }
}

function zalgo(text) {
  const combining = '̢̧̨̡̛̖̗̘̙̜̝̞̟̠̣̤̥̦̩̪̫̬̭̮̯̰̱̲̳̹̺̻̼͇͈͉͍͎̀́̂̃̄̅̆̇̈̉̊̋̌̍̎̏̐̑̒̓̔̽̾̿̀́͂̓̈́͆͊͋͌'.split('');
  return text.split('').map(c => {
    if (c === ' ') return c;
    let res = c;
    for (let i = 0; i < 3; i++) res += combining[Math.floor(Math.random() * combining.length)];
    return res;
  }).join('');
}

function toSmallCaps(text) {
  const map = { a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'s',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ' };
  return text.toLowerCase().split('').map(c => map[c] || c).join('');
}

function toUpsideDown(text) {
  const map = { a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z' };
  return text.toLowerCase().split('').reverse().map(c => map[c] || c).join('');
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

const commands = [
  {
    name: 'upper',
    aliases: ['maj', 'majuscule', 'uppercase'],
    description: 'Convertir en MAJUSCULES',
    category: 'Texte',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!upper <texte>`');
      return message.reply('**' + args.join(' ').toUpperCase() + '**');
    }
  },
  {
    name: 'lower',
    aliases: ['min', 'minuscule', 'lowercase'],
    description: 'Convertir en minuscules',
    category: 'Texte',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!lower <texte>`');
      return message.reply(args.join(' ').toLowerCase());
    }
  },
  {
    name: 'morse',
    aliases: ['encodemorse', 'tocode'],
    description: 'Convertir en code Morse',
    category: 'Texte',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!morse <texte>`');
      const result = toMorse(args.join(' '));
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle('📡 Code Morse').setDescription(`\`${result.slice(0, 1000)}\``)] });
    }
  },
  {
    name: 'binary',
    aliases: ['binaire', 'bin', 'tobinary'],
    description: 'Convertir en binaire',
    category: 'Texte',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!binary <texte>`');
      const result = toBinary(args.join(' ').slice(0, 50));
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('💻 Binaire').setDescription(`\`${result.slice(0, 1000)}\``)] });
    }
  },
  {
    name: 'base64',
    aliases: ['b64', 'encode64'],
    description: 'Encoder en Base64',
    category: 'Texte',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!base64 <texte>`');
      const result = toBase64(args.join(' '));
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22').setTitle('🔒 Base64').setDescription(`\`${result.slice(0, 1000)}\``)] });
    }
  },
  {
    name: 'debase64',
    aliases: ['db64', 'decode64', 'frombase64'],
    description: 'Décoder depuis Base64',
    category: 'Texte',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!debase64 <base64>`');
      const result = fromBase64(args[0]);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22').setTitle('🔓 Décodé').setDescription(result.slice(0, 1000))] });
    }
  },
  {
    name: 'caesar',
    aliases: ['cesar', 'chiffrement', 'rot'],
    description: 'Chiffrement de César',
    category: 'Texte',
    cooldown: 2,
    async execute(message, args) {
      if (args.length < 2) return message.reply('❌ Usage : `n!caesar <décalage> <texte>`');
      const shift = parseInt(args[0]);
      if (isNaN(shift)) return message.reply('❌ Le décalage doit être un nombre.');
      const text = args.slice(1).join(' ');
      const result = caesar(text, ((shift % 26) + 26) % 26);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6').setTitle(`🔐 César (décalage: ${shift})`).setDescription(`\`${result}\``)] });
    }
  },
  {
    name: 'zalgo',
    aliases: ['glitch', 'corrupt', 'scary'],
    description: 'Transformer en texte glitch Zalgo',
    category: 'Texte',
    cooldown: 3,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!zalgo <texte>`');
      const result = zalgo(args.join(' ').slice(0, 100));
      return message.reply(result.slice(0, 500));
    }
  },
  {
    name: 'smallcaps',
    aliases: ['petitecaps', 'smalltext'],
    description: 'Convertir en petites capitales',
    category: 'Texte',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!smallcaps <texte>`');
      return message.reply(toSmallCaps(args.join(' ')));
    }
  },
  {
    name: 'upsidedown',
    aliases: ['inverse', 'flip_text', 'fliptext'],
    description: 'Retourner le texte à l\'envers',
    category: 'Texte',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!upsidedown <texte>`');
      return message.reply(toUpsideDown(args.join(' ')));
    }
  },
  {
    name: 'wordcount',
    aliases: ['compter', 'wc', 'mots'],
    description: 'Compter les mots dans un texte',
    category: 'Texte',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!wordcount <texte>`');
      const text = args.join(' ');
      const words = countWords(text);
      const chars = text.length;
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('📊 Statistiques texte')
        .addFields(
          { name: '📝 Mots', value: `**${words}**`, inline: true },
          { name: '🔤 Caractères', value: `**${chars}**`, inline: true },
          { name: '📄 Phrases', value: `**${sentences}**`, inline: true },
        )
      ]});
    }
  },
  {
    name: 'spacer',
    aliases: ['espacer', 'space'],
    description: 'Espacer les lettres d\'un texte',
    category: 'Texte',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!spacer <texte>`');
      return message.reply(args.join(' ').split('').join(' ').slice(0, 500));
    }
  },
  {
    name: 'alternate',
    aliases: ['alternance', 'alt'],
    description: 'Alterner majuscules et minuscules',
    category: 'Texte',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!alternate <texte>`');
      const result = args.join(' ').split('').map((c, i) => i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()).join('');
      return message.reply(result);
    }
  },
  {
    name: 'repeat',
    aliases: ['repeter', 'rep'],
    description: 'Répéter un texte N fois',
    category: 'Texte',
    cooldown: 3,
    async execute(message, args) {
      if (args.length < 2) return message.reply('❌ Usage : `n!repeat <fois> <texte>`');
      const times = Math.min(10, Math.max(1, parseInt(args[0]) || 1));
      const text = args.slice(1).join(' ');
      return message.reply((text + '\n').repeat(times).slice(0, 1000));
    }
  },
  {
    name: 'acronyme',
    aliases: ['acro', 'sigles', 'acronym'],
    description: 'Créer un acronyme',
    category: 'Texte',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!acronyme <phrase>`');
      const text = args.join(' ');
      const acro = text.split(' ').map(w => w[0]?.toUpperCase() || '').join('');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB').setDescription(`**${acro}** *(${text})*`)] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
