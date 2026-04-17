/**
 * NexusBot — Commandes mathématiques (prefix)
 * n!calc, n!convert, n!pgcd, n!ppcm, n!premier, n!fib, n!facto, n!stats, n!geo, n!hex, n!bin2dec, n!dec2hex...
 */
const { EmbedBuilder } = require('discord.js');

function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false;
  return true;
}
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function lcm(a, b) { return (a * b) / gcd(a, b); }
function factorial(n) { if (n <= 1) return 1n; return BigInt(n) * factorial(n - 1); }
function fibonacci(n) {
  let a = 0n, b = 1n;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}
function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

const CONV = {
  km_miles: v => (v * 0.621371).toFixed(4),
  miles_km: v => (v * 1.60934).toFixed(4),
  kg_lbs:   v => (v * 2.20462).toFixed(4),
  lbs_kg:   v => (v * 0.453592).toFixed(4),
  c_f:      v => ((v * 9/5) + 32).toFixed(2),
  f_c:      v => ((v - 32) * 5/9).toFixed(2),
  m_ft:     v => (v * 3.28084).toFixed(4),
  ft_m:     v => (v * 0.3048).toFixed(4),
  l_gal:    v => (v * 0.264172).toFixed(4),
  gal_l:    v => (v * 3.78541).toFixed(4),
};

const commands = [
  {
    name: 'calc',
    aliases: ['calculer', 'math', '='],
    description: 'Calculatrice avancée',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!calc <expression>` ex: `n!calc 2+2*3`');
      const expr = args.join(' ').replace(/[^0-9+\-*/().%^ ]/g, '');
      if (!expr) return message.reply('❌ Expression invalide. Utilisez uniquement des chiffres et opérateurs.');
      try {
        // Safe eval replacement
        const result = Function('"use strict"; return (' + expr.replace(/\^/g, '**') + ')')();
        if (!isFinite(result)) return message.reply('❌ Résultat infini ou invalide.');
        return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('🧮 Calculatrice')
          .addFields(
            { name: '📥 Expression', value: `\`${expr}\``, inline: true },
            { name: '📤 Résultat', value: `**${result.toLocaleString('fr-FR')}**`, inline: true },
          )] });
      } catch { return message.reply('❌ Expression invalide.'); }
    }
  },
  {
    name: 'convert',
    aliases: ['conv', 'convertir', 'cvt'],
    description: 'Convertir des unités (km, kg, °C, °F...)',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      if (args.length < 2) return message.reply('❌ Usage : `n!convert <valeur> <unité>` ex: `n!convert 100 km_miles`\nUnités : km_miles, miles_km, kg_lbs, lbs_kg, c_f, f_c, m_ft, ft_m, l_gal, gal_l');
      const val = parseFloat(args[0]);
      const unit = args[1]?.toLowerCase();
      if (isNaN(val)) return message.reply('❌ Valeur invalide.');
      if (!CONV[unit]) return message.reply(`❌ Unité inconnue. Disponibles : ${Object.keys(CONV).join(', ')}`);
      const result = CONV[unit](val);
      const [from, to] = unit.split('_');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('📐 Conversion')
        .setDescription(`**${val} ${from}** = **${result} ${to}**`)] });
    }
  },
  {
    name: 'pgcd',
    aliases: ['gcd', 'euclide'],
    description: 'Calculer le PGCD de deux nombres',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      const [a, b] = args.map(Number);
      if (!a || !b || isNaN(a) || isNaN(b)) return message.reply('❌ Usage : `n!pgcd <a> <b>`');
      return message.reply(`📐 PGCD(${a}, ${b}) = **${gcd(Math.abs(Math.round(a)), Math.abs(Math.round(b)))}**`);
    }
  },
  {
    name: 'ppcm',
    aliases: ['lcm'],
    description: 'Calculer le PPCM de deux nombres',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      const [a, b] = args.map(Number);
      if (!a || !b || isNaN(a) || isNaN(b)) return message.reply('❌ Usage : `n!ppcm <a> <b>`');
      return message.reply(`📐 PPCM(${a}, ${b}) = **${lcm(Math.abs(Math.round(a)), Math.abs(Math.round(b)))}**`);
    }
  },
  {
    name: 'premier',
    aliases: ['prime', 'isprime'],
    description: 'Vérifier si un nombre est premier',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      const n = parseInt(args[0]);
      if (isNaN(n) || n < 0) return message.reply('❌ Usage : `n!premier <nombre>`');
      if (n > 1e8) return message.reply('❌ Nombre trop grand (max 100 000 000).');
      return message.reply(`🔢 **${n}** est ${isPrime(n) ? '✅ **premier**' : '❌ **pas premier**'}`);
    }
  },
  {
    name: 'facteurs',
    aliases: ['factors', 'decomposer', 'decomp'],
    description: 'Décomposition en facteurs premiers',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      let n = parseInt(args[0]);
      if (isNaN(n) || n < 2 || n > 1e7) return message.reply('❌ Usage : `n!facteurs <nombre>` (2 à 10 000 000)');
      const factors = [];
      for (let d = 2; d * d <= n; d++) {
        while (n % d === 0) { factors.push(d); n = Math.floor(n / d); }
      }
      if (n > 1) factors.push(n);
      return message.reply(`🔢 Facteurs de **${args[0]}** : **${factors.join(' × ')}**`);
    }
  },
  {
    name: 'fibonacci',
    aliases: ['fib', 'suite_fib'],
    description: 'Calculer le n-ième terme de Fibonacci',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      const n = parseInt(args[0]);
      if (isNaN(n) || n < 0 || n > 500) return message.reply('❌ Usage : `n!fibonacci <n>` (0 à 500)');
      const result = fibonacci(n).toString();
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle('🌀 Suite de Fibonacci')
        .setDescription(`F(**${n}**) = \`${result.length > 200 ? result.slice(0,200)+'...' : result}\``)] });
    }
  },
  {
    name: 'factorielle',
    aliases: ['facto', 'factorial'],
    description: 'Calculer la factorielle d\'un nombre',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      const n = parseInt(args[0]);
      if (isNaN(n) || n < 0 || n > 200) return message.reply('❌ Usage : `n!factorielle <n>` (0 à 200)');
      const result = factorial(n).toString();
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6').setTitle('🔢 Factorielle')
        .setDescription(`${n}! = \`${result.length > 200 ? result.slice(0,200)+'...' : result}\`\n*(${result.length} chiffres)*`)] });
    }
  },
  {
    name: 'stats',
    aliases: ['statistiques', 'moyenne', 'stat'],
    description: 'Calcul statistique sur une série de nombres',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!stats 4 8 15 16 23 42`');
      const nums = args.map(Number).filter(n => !isNaN(n));
      if (nums.length < 2) return message.reply('❌ Donnez au moins 2 nombres.');
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22').setTitle('📊 Statistiques')
        .addFields(
          { name: '📈 Moyenne', value: mean(nums).toFixed(4), inline: true },
          { name: '📉 Médiane', value: median.toString(), inline: true },
          { name: '📊 Écart-type', value: stddev(nums).toFixed(4), inline: true },
          { name: '⬇️ Min', value: Math.min(...nums).toString(), inline: true },
          { name: '⬆️ Max', value: Math.max(...nums).toString(), inline: true },
          { name: '🔢 N', value: nums.length.toString(), inline: true },
        )] });
    }
  },
  {
    name: 'hex',
    aliases: ['hexadecimal', 'dec2hex'],
    description: 'Convertir décimal → hexadécimal',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      const n = parseInt(args[0]);
      if (isNaN(n)) return message.reply('❌ Usage : `n!hex <nombre_décimal>`');
      return message.reply(`🔢 **${n}** en hexadécimal = **0x${n.toString(16).toUpperCase()}**`);
    }
  },
  {
    name: 'hex2dec',
    aliases: ['fromhex', 'hexdec'],
    description: 'Convertir hexadécimal → décimal',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      const h = args[0]?.replace(/^0x/i, '');
      if (!h) return message.reply('❌ Usage : `n!hex2dec <valeur_hex>` ex: `n!hex2dec FF`');
      const n = parseInt(h, 16);
      if (isNaN(n)) return message.reply('❌ Valeur hexadécimale invalide.');
      return message.reply(`🔢 **0x${h.toUpperCase()}** en décimal = **${n}**`);
    }
  },
  {
    name: 'bin2dec',
    aliases: ['frombinary', 'bindec'],
    description: 'Convertir binaire → décimal',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      const b = args[0];
      if (!b || !/^[01]+$/.test(b)) return message.reply('❌ Usage : `n!bin2dec <binaire>` ex: `n!bin2dec 1010`');
      return message.reply(`🔢 **${b}** en décimal = **${parseInt(b, 2)}**`);
    }
  },
  {
    name: 'cercle',
    aliases: ['circle', 'pi_calc'],
    description: 'Calcul : périmètre et aire d\'un cercle',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      const r = parseFloat(args[0]);
      if (isNaN(r) || r <= 0) return message.reply('❌ Usage : `n!cercle <rayon>`');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('⭕ Cercle (r = ' + r + ')')
        .addFields(
          { name: '📏 Périmètre', value: `**${(2 * Math.PI * r).toFixed(4)}**`, inline: true },
          { name: '📐 Aire', value: `**${(Math.PI * r * r).toFixed(4)}**`, inline: true },
          { name: '📍 π', value: Math.PI.toFixed(10), inline: false },
        )] });
    }
  },
  {
    name: 'triangle',
    aliases: ['hypotenuse', 'pythagore'],
    description: 'Calculer l\'hypoténuse (Pythagore)',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      const [a, b] = args.map(parseFloat);
      if (isNaN(a) || isNaN(b) || a <= 0 || b <= 0) return message.reply('❌ Usage : `n!triangle <a> <b>`');
      const c = Math.sqrt(a * a + b * b);
      return message.reply(`📐 Triangle rectangle : a=${a}, b=${b} → **hypoténuse c = ${c.toFixed(6)}**`);
    }
  },
  {
    name: 'puissance',
    aliases: ['pow', 'exposant'],
    description: 'Calculer a^n',
    category: 'Mathématiques',
    cooldown: 2,
    async execute(message, args) {
      const [a, n] = args.map(Number);
      if (isNaN(a) || isNaN(n)) return message.reply('❌ Usage : `n!puissance <base> <exposant>`');
      const result = Math.pow(a, n);
      if (!isFinite(result)) return message.reply('❌ Résultat trop grand.');
      return message.reply(`🔢 **${a}^${n}** = **${result.toLocaleString('fr-FR')}**`);
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
