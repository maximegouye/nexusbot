/**
 * NexusBot — Système de ville virtuelle
 * UNIQUE : créer une ville, construire des bâtiments, taxes, population, guerres
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS villes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, mayor_id TEXT,
    name TEXT,
    slogan TEXT DEFAULT '',
    level INTEGER DEFAULT 1,
    population INTEGER DEFAULT 100,
    treasury INTEGER DEFAULT 500,
    income_per_hour INTEGER DEFAULT 30,
    tax_rate INTEGER DEFAULT 10,
    buildings TEXT DEFAULT '{}',
    allies TEXT DEFAULT '[]',
    at_war_with TEXT DEFAULT '[]',
    happiness INTEGER DEFAULT 50,
    last_collect INTEGER DEFAULT (strftime('%s','now')),
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, mayor_id)
  )`).run();
} catch {}

const BUILDINGS = {
  ecole:      { emoji:'🏫', name:'École',        cost:1000, income_bonus:0,  pop_bonus:50,  max:3, desc:'Augmente la population et la culture' },
  hopital:    { emoji:'🏥', name:'Hôpital',      cost:1500, income_bonus:0,  pop_bonus:30,  max:2, desc:'Améliore le bonheur et la santé' },
  usine:      { emoji:'🏭', name:'Usine',        cost:2000, income_bonus:40, pop_bonus:0,   max:5, desc:'Génère des revenus supplémentaires/h' },
  banque:     { emoji:'🏦', name:'Banque',       cost:3000, income_bonus:80, pop_bonus:0,   max:2, desc:'Multiplie les revenus de la ville' },
  stade:      { emoji:'🏟️', name:'Stade',        cost:2500, income_bonus:30, pop_bonus:100, max:1, desc:'Attire des habitants et génère des revenus' },
  bibliotheque:{ emoji:'📚', name:'Bibliothèque', cost:800,  income_bonus:10, pop_bonus:20,  max:2, desc:'Culture et bonheur' },
  aeroport:   { emoji:'✈️', name:'Aéroport',     cost:5000, income_bonus:100,pop_bonus:200, max:1, desc:'Hub commercial et touristique' },
  parc:       { emoji:'🌳', name:'Parc',         cost:500,  income_bonus:0,  pop_bonus:10,  max:5, desc:'Améliore le bonheur des habitants' },
  commissariat:{ emoji:'🚓', name:'Commissariat', cost:1200, income_bonus:0,  pop_bonus:0,   max:2, desc:'Réduit la criminalité, stabilise la ville' },
  mairie:     { emoji:'🏛️', name:'Mairie',       cost:2000, income_bonus:20, pop_bonus:50,  max:1, desc:'Centre administratif, augmente l\'efficacité' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ville')
    .setDescription('🏙️ Créez et gérez votre propre ville virtuelle !')
    .addSubcommand(s => s.setName('fonder').setDescription('🏗️ Fonder votre ville')
      .addStringOption(o => o.setName('nom').setDescription('Nom de votre ville').setRequired(true).setMaxLength(40))
      .addStringOption(o => o.setName('slogan').setDescription('Slogan de votre ville').setMaxLength(80)))
    .addSubcommand(s => s.setName('voir').setDescription('🏙️ Voir une ville')
      .addUserOption(o => o.setName('maire').setDescription('Voir la ville d\'un autre maire')))
    .addSubcommand(s => s.setName('construire').setDescription('🏗️ Construire un bâtiment')
      .addStringOption(o => o.setName('batiment').setDescription('Bâtiment à construire').setRequired(true)
        .addChoices(...Object.entries(BUILDINGS).map(([k, v]) => ({ name: `${v.emoji} ${v.name} — ${v.desc}`, value: k })))))
    .addSubcommand(s => s.setName('collecter').setDescription('💰 Collecter les taxes de votre ville'))
    .addSubcommand(s => s.setName('taxer').setDescription('📊 Changer le taux de taxe (0-25%)')
      .addIntegerOption(o => o.setName('taux').setDescription('Taux en % (0-25)').setRequired(true).setMinValue(0).setMaxValue(25)))
    .addSubcommand(s => s.setName('slogan').setDescription('✏️ Changer le slogan de votre ville')
      .addStringOption(o => o.setName('texte').setDescription('Nouveau slogan').setRequired(true).setMaxLength(80)))
    .addSubcommand(s => s.setName('batiments').setDescription('🏗️ Liste des bâtiments disponibles'))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Classement des villes les plus riches')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'fonder') {
      const existing = db.db.prepare('SELECT id FROM villes WHERE guild_id=? AND mayor_id=?').get(guildId, userId);
      if (existing) return interaction.reply({ content: '❌ Vous avez déjà une ville.', ephemeral: true });

      const cost = 2000;
      const u = db.getUser(userId, guildId);
      if ((u.balance || 0) < cost) return interaction.reply({ content: `❌ Fonder une ville coûte **${cost} ${coin}**.`, ephemeral: true });

      const nom = interaction.options.getString('nom');
      const slogan = interaction.options.getString('slogan') || 'Bienvenue dans ma ville !';
      db.addCoins(userId, guildId, -cost);
      db.db.prepare('INSERT INTO villes (guild_id,mayor_id,name,slogan) VALUES(?,?,?,?)').run(guildId, userId, nom, slogan);

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle(`🏙️ ${nom} — Fondée !`)
        .setDescription(`**Slogan :** *${slogan}*\n\nVotre ville génère **30 ${coin}/heure** en taxes.\nConstituez des bâtiments avec \`/ville construire\` !`)
        .addFields(
          { name: '👥 Population', value: '100', inline: true },
          { name: '💰 Trésorerie', value: `500 ${coin}`, inline: true },
          { name: '📊 Taxe', value: '10%', inline: true },
        )
      ]});
    }

    if (sub === 'voir') {
      const target = interaction.options.getUser('maire') || interaction.user;
      const ville = db.db.prepare('SELECT * FROM villes WHERE guild_id=? AND mayor_id=?').get(guildId, target.id);
      if (!ville) return interaction.reply({ content: `❌ **${target.username}** n'a pas de ville.`, ephemeral: true });

      const buildings = JSON.parse(ville.buildings || '{}');
      const hoursElapsed = (now - ville.last_collect) / 3600;
      const pending = Math.floor(ville.income_per_hour * hoursElapsed);
      const bList = Object.entries(buildings).filter(([, v]) => v > 0).map(([k, v]) => `${BUILDINGS[k]?.emoji || '🏗️'} ${BUILDINGS[k]?.name || k}: ${v}`).join(', ') || 'Aucun bâtiment';

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle(`🏙️ ${ville.name}`)
        .setDescription(`Maire : <@${target.id}>\n*"${ville.slogan}"*`)
        .addFields(
          { name: '👥 Population', value: `**${ville.population.toLocaleString()}**`, inline: true },
          { name: '💰 Trésorerie', value: `**${ville.treasury.toLocaleString()} ${coin}**`, inline: true },
          { name: '📊 Taxe/h', value: `**${ville.income_per_hour} ${coin}** (${ville.tax_rate}%)`, inline: true },
          { name: '😊 Bonheur', value: `**${ville.happiness}%**`, inline: true },
          { name: '⏳ À collecter', value: `**~${pending.toLocaleString()} ${coin}**`, inline: true },
          { name: '📈 Niveau', value: `**${ville.level}**`, inline: true },
          { name: '🏗️ Bâtiments', value: bList, inline: false },
        )
      ]});
    }

    if (sub === 'construire') {
      const ville = db.db.prepare('SELECT * FROM villes WHERE guild_id=? AND mayor_id=?').get(guildId, userId);
      if (!ville) return interaction.reply({ content: '❌ Vous n\'avez pas de ville.', ephemeral: true });

      const type = interaction.options.getString('batiment');
      const bld = BUILDINGS[type];
      const buildings = JSON.parse(ville.buildings || '{}');
      const current = buildings[type] || 0;

      if (current >= bld.max) return interaction.reply({ content: `❌ Vous avez déjà le maximum de **${bld.name}** (${bld.max}).`, ephemeral: true });

      const cost = bld.cost * (current + 1);
      const u = db.getUser(userId, guildId);
      if ((u.balance || 0) < cost) return interaction.reply({ content: `❌ Cette construction coûte **${cost.toLocaleString()} ${coin}**.`, ephemeral: true });

      buildings[type] = (buildings[type] || 0) + 1;
      const newPop = ville.population + bld.pop_bonus;
      const newIncome = ville.income_per_hour + bld.income_bonus;
      db.addCoins(userId, guildId, -cost);
      db.db.prepare('UPDATE villes SET buildings=?, population=?, income_per_hour=? WHERE guild_id=? AND mayor_id=?')
        .run(JSON.stringify(buildings), newPop, newIncome, guildId, userId);

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle(`${bld.emoji} ${bld.name} construite !`)
        .addFields(
          { name: '💰 Coût', value: `-${cost.toLocaleString()} ${coin}`, inline: true },
          { name: '👥 Population', value: bld.pop_bonus > 0 ? `+${bld.pop_bonus}` : '—', inline: true },
          { name: '📈 Revenus/h', value: bld.income_bonus > 0 ? `+${bld.income_bonus} ${coin}` : '—', inline: true },
        )
      ]});
    }

    if (sub === 'collecter') {
      const ville = db.db.prepare('SELECT * FROM villes WHERE guild_id=? AND mayor_id=?').get(guildId, userId);
      if (!ville) return interaction.reply({ content: '❌ Vous n\'avez pas de ville.', ephemeral: true });

      const hoursElapsed = (now - ville.last_collect) / 3600;
      if (hoursElapsed < 0.083) return interaction.reply({ content: '⏳ Attendez au moins 5 minutes avant de collecter.', ephemeral: true });

      const earned = Math.floor(ville.income_per_hour * hoursElapsed);
      db.addCoins(userId, guildId, earned);
      db.db.prepare('UPDATE villes SET last_collect=?, treasury=treasury+? WHERE guild_id=? AND mayor_id=?').run(now, earned, guildId, userId);

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle(`💰 Taxes collectées — ${ville.name}`)
        .setDescription(`**+${earned.toLocaleString()} ${coin}** de taxes collectées en **${hoursElapsed.toFixed(1)}h** !`)
        .addFields(
          { name: '📈 Taux/h', value: `${ville.income_per_hour} ${coin}/h`, inline: true },
          { name: '👥 Pop', value: `${ville.population.toLocaleString()}`, inline: true },
        )
      ]});
    }

    if (sub === 'taxer') {
      const ville = db.db.prepare('SELECT * FROM villes WHERE guild_id=? AND mayor_id=?').get(guildId, userId);
      if (!ville) return interaction.reply({ content: '❌ Vous n\'avez pas de ville.', ephemeral: true });
      const taux = interaction.options.getInteger('taux');
      const newIncome = Math.floor(ville.population * taux / 100);
      db.db.prepare('UPDATE villes SET tax_rate=?, income_per_hour=?, happiness=? WHERE guild_id=? AND mayor_id=?')
        .run(taux, newIncome, Math.max(0, Math.min(100, 80 - taux * 2)), guildId, userId);
      return interaction.reply({ content: `✅ Taux de taxe défini à **${taux}%**. Revenus/h : **${newIncome} ${coin}**. Bonheur : **${Math.max(0, 80 - taux * 2)}%**` });
    }

    if (sub === 'slogan') {
      const ville = db.db.prepare('SELECT * FROM villes WHERE guild_id=? AND mayor_id=?').get(guildId, userId);
      if (!ville) return interaction.reply({ content: '❌ Vous n\'avez pas de ville.', ephemeral: true });
      const texte = interaction.options.getString('texte');
      db.db.prepare('UPDATE villes SET slogan=? WHERE guild_id=? AND mayor_id=?').run(texte, guildId, userId);
      return interaction.reply({ content: `✅ Nouveau slogan : *"${texte}"*` });
    }

    if (sub === 'batiments') {
      const lines = Object.entries(BUILDINGS).map(([k, v]) => `${v.emoji} **${v.name}** — ${v.cost.toLocaleString()} ${coin}\n> Pop: +${v.pop_bonus} • Revenus/h: +${v.income_bonus} • Max: ${v.max}\n> *${v.desc}*`).join('\n\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('🏗️ Bâtiments disponibles').setDescription(lines)] });
    }

    if (sub === 'classement') {
      const top = db.db.prepare('SELECT * FROM villes WHERE guild_id=? ORDER BY treasury DESC LIMIT 10').all(guildId);
      if (!top.length) return interaction.reply({ content: '❌ Aucune ville sur ce serveur.', ephemeral: true });
      const medals = ['🥇', '🥈', '🥉'];
      const desc = top.map((v, i) => `${medals[i] || `**${i+1}.**`} 🏙️ **${v.name}** (<@${v.mayor_id}>) — Pop: ${v.population.toLocaleString()} • Tréso: ${v.treasury.toLocaleString()} ${coin}`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle('🏙️ Top Villes').setDescription(desc)] });
    }
  }
};
