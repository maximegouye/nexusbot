/**
 * NexusBot — Temps et date (prefix)
 * n!heure, n!date, n!fuseau, n!countdown, n!age, n!jour_semaine, n!unix, n!calendrier...
 */
const { EmbedBuilder } = require('discord.js');

const FUSEAUX = {
  paris:      'Europe/Paris',
  london:     'Europe/London',
  newyork:    'America/New_York',
  losangeles: 'America/Los_Angeles',
  tokyo:      'Asia/Tokyo',
  sydney:     'Australia/Sydney',
  dubai:      'Asia/Dubai',
  moscow:     'Europe/Moscow',
  beijing:    'Asia/Shanghai',
  saopaulo:   'America/Sao_Paulo',
  montreal:   'America/Montreal',
  dakar:      'Africa/Dakar',
  abidjan:    'Africa/Abidjan',
  tunis:      'Africa/Tunis',
  casablanca: 'Africa/Casablanca',
};

const JOURS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const MOIS  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function formatDate(d, tz = 'Europe/Paris') {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: tz,
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short'
  }).format(d);
}

const commands = [
  {
    name: 'heure',
    aliases: ['time', 'horloge', 'maintenant'],
    description: 'Afficher l\'heure actuelle',
    category: 'Temps',
    cooldown: 3,
    async execute(message, args) {
      const tz = args[0] ? (FUSEAUX[args[0].toLowerCase()] || args[0]) : 'Europe/Paris';
      const now = new Date();
      try {
        const formatted = formatDate(now, tz);
        return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
          .setTitle('🕐 Heure actuelle')
          .setDescription(`**${formatted}**`)
          .setFooter({ text: `Fuseau : ${tz} | Timestamp Unix : ${Math.floor(now/1000)}` })] });
      } catch {
        return message.reply(`❌ Fuseau horaire inconnu. Disponibles : ${Object.keys(FUSEAUX).join(', ')}`);
      }
    }
  },
  {
    name: 'fuseau',
    aliases: ['timezone', 'fuseaux', 'worldtime'],
    description: 'Comparer l\'heure dans plusieurs villes du monde',
    category: 'Temps',
    cooldown: 5,
    async execute(message, args) {
      const villes = ['paris', 'london', 'newyork', 'tokyo', 'sydney', 'dubai', 'moscow', 'dakar'];
      const now = new Date();
      const lines = villes.map(v => {
        const tz = FUSEAUX[v];
        const time = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(now);
        const city = v.charAt(0).toUpperCase() + v.slice(1);
        return `🌍 **${city}** → \`${time}\``;
      });
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle('🌐 Fuseaux horaires')
        .setDescription(lines.join('\n'))] });
    }
  },
  {
    name: 'age',
    aliases: ['mon_age', 'naissance', 'anniversaire_age'],
    description: 'Calculer l\'âge depuis une date de naissance',
    category: 'Temps',
    cooldown: 3,
    async execute(message, args) {
      if (!args[0]) return message.reply('❌ Usage : `n!age <DD/MM/AAAA>` ex: `n!age 15/04/1995`');
      const parts = args[0].split('/');
      if (parts.length !== 3) return message.reply('❌ Format : DD/MM/AAAA');
      const [d, m, y] = parts.map(Number);
      if (!d || !m || !y || d > 31 || m > 12 || y < 1900) return message.reply('❌ Date invalide.');
      const birth = new Date(y, m - 1, d);
      const now = new Date();
      if (birth > now) return message.reply('❌ Date de naissance dans le futur ?');
      let age = now.getFullYear() - birth.getFullYear();
      const mDiff = now.getMonth() - birth.getMonth();
      if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) age--;
      const days = Math.floor((now - birth) / 86400000);
      const nextBday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
      if (nextBday < now) nextBday.setFullYear(nextBday.getFullYear() + 1);
      const daysToNext = Math.ceil((nextBday - now) / 86400000);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle('🎂 Calculateur d\'âge')
        .addFields(
          { name: '🎂 Âge', value: `**${age} ans**`, inline: true },
          { name: '📅 Jours vécus', value: `**${days.toLocaleString()}**`, inline: true },
          { name: '🎉 Prochain anniv.', value: `Dans **${daysToNext}** jours`, inline: true },
        )] });
    }
  },
  {
    name: 'jour_semaine',
    aliases: ['jourdate', 'quel_jour', 'weekday'],
    description: 'Quel jour de la semaine est une date ?',
    category: 'Temps',
    cooldown: 3,
    async execute(message, args) {
      if (!args[0]) return message.reply('❌ Usage : `n!jour_semaine <DD/MM/AAAA>`');
      const parts = args[0].split('/');
      if (parts.length !== 3) return message.reply('❌ Format : DD/MM/AAAA');
      const [d, m, y] = parts.map(Number);
      const date = new Date(y, m - 1, d);
      if (isNaN(date.getTime())) return message.reply('❌ Date invalide.');
      const jour = JOURS[date.getDay()];
      const moisNom = MOIS[date.getMonth()];
      return message.reply(`📅 Le **${d} ${moisNom} ${y}** est un **${jour}**.`);
    }
  },
  {
    name: 'unix',
    aliases: ['timestamp', 'epoch', 'unixtime'],
    description: 'Convertir timestamp Unix en date lisible',
    category: 'Temps',
    cooldown: 2,
    async execute(message, args) {
      const ts = args[0] ? parseInt(args[0]) : Math.floor(Date.now() / 1000);
      if (isNaN(ts)) return message.reply('❌ Usage : `n!unix [timestamp]`');
      const date = new Date(ts * 1000);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle('⏱️ Timestamp Unix')
        .addFields(
          { name: '🔢 Unix', value: `\`${ts}\``, inline: true },
          { name: '📅 Date', value: date.toLocaleDateString('fr-FR'), inline: true },
          { name: '⏰ Heure (Paris)', value: date.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' }), inline: true },
          { name: '📆 Discord', value: `<t:${ts}:F>`, inline: false },
        )] });
    }
  },
  {
    name: 'jours_restants',
    aliases: ['countdown_year', 'fin_annee', 'noel'],
    description: 'Jours restants avant une date spéciale',
    category: 'Temps',
    cooldown: 3,
    async execute(message, args) {
      const now = new Date();
      const year = now.getFullYear();
      const events = [
        { name:'Noël', date: new Date(year, 11, 25) },
        { name:'Jour de l\'An', date: new Date(year, 11, 31) },
        { name:'Fête Nationale (14 juillet)', date: new Date(year, 6, 14) },
        { name:'Saint-Valentin', date: new Date(year, 1, 14) },
        { name:'1er Mai', date: new Date(year, 4, 1) },
      ];
      events.forEach(e => { if (e.date < now) e.date.setFullYear(year + 1); });
      const desc = events.map(e => {
        const days = Math.ceil((e.date - now) / 86400000);
        return `🗓️ **${e.name}** — dans **${days}** jours`;
      }).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('⏳ Compte à rebours')
        .setDescription(desc)] });
    }
  },
  {
    name: 'duree',
    aliases: ['difdate', 'entre_dates', 'duration'],
    description: 'Durée entre deux dates',
    category: 'Temps',
    cooldown: 3,
    async execute(message, args) {
      if (args.length < 2) return message.reply('❌ Usage : `n!duree <DD/MM/AAAA> <DD/MM/AAAA>`');
      function parseDate(s) {
        const [d, m, y] = s.split('/').map(Number);
        return new Date(y, m - 1, d);
      }
      const d1 = parseDate(args[0]);
      const d2 = parseDate(args[1]);
      if (isNaN(d1) || isNaN(d2)) return message.reply('❌ Format invalide. Utilisez DD/MM/AAAA.');
      const diff = Math.abs(d2 - d1);
      const days = Math.floor(diff / 86400000);
      const weeks = Math.floor(days / 7);
      const months = Math.floor(days / 30.44);
      const years = Math.floor(days / 365.25);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle('📅 Durée entre deux dates')
        .addFields(
          { name: '📆 Jours', value: `**${days.toLocaleString()}**`, inline: true },
          { name: '🗓️ Semaines', value: `**${weeks.toLocaleString()}**`, inline: true },
          { name: '📅 Mois', value: `**~${months}**`, inline: true },
          { name: '🗓️ Années', value: `**~${years}**`, inline: true },
        )] });
    }
  },
  {
    name: 'calendrier',
    aliases: ['cal', 'mois_cal'],
    description: 'Calendrier du mois en cours en texte',
    category: 'Temps',
    cooldown: 5,
    async execute(message, args) {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const today = now.getDate();
      const firstDay = new Date(y, m, 1).getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      let cal = `**${MOIS[m]} ${y}**\n\`\`\`\nLu Ma Me Je Ve Sa Di\n`;
      let row = ' '.repeat(((firstDay + 6) % 7) * 3);
      for (let d = 1; d <= daysInMonth; d++) {
        const pad = d < 10 ? ' ' + d : '' + d;
        row += (d === today ? `[${pad}]` : ` ${pad} `).slice(0, 3) + ' ';
        if ((d + (firstDay + 6) % 7) % 7 === 0) { cal += row.trimEnd() + '\n'; row = ''; }
      }
      if (row.trim()) cal += row.trimEnd() + '\n';
      cal += '```';
      return message.reply(cal);
    }
  },
  {
    name: 'semaine_numero',
    aliases: ['week_num', 'iso_week', 'num_semaine'],
    description: 'Numéro de semaine ISO de la date d\'aujourd\'hui',
    category: 'Temps',
    cooldown: 3,
    async execute(message, args) {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now - startOfYear) / 86400000);
      const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      return message.reply(`📅 Nous sommes à la **semaine ${week}** de l'année ${now.getFullYear()}.`);
    }
  },
  {
    name: 'dans_combien',
    aliases: ['dans_x_jours', 'future_date', 'add_days'],
    description: 'Quelle date serons-nous dans N jours ?',
    category: 'Temps',
    cooldown: 3,
    async execute(message, args) {
      const n = parseInt(args[0]);
      if (isNaN(n)) return message.reply('❌ Usage : `n!dans_combien <nombre_jours>`');
      const future = new Date(Date.now() + n * 86400000);
      const jour = JOURS[future.getDay()];
      const d = future.getDate();
      const m = MOIS[future.getMonth()];
      const y = future.getFullYear();
      return message.reply(`📅 Dans **${n} jours**, nous serons le **${jour} ${d} ${m} ${y}**.`);
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
