/**
 * NexusBot — Système d'entreprises virtuelles
 * UNIQUE : créer une entreprise, embaucher des membres, générer des profits passifs
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS entreprises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, owner_id TEXT,
    name TEXT, secteur TEXT,
    level INTEGER DEFAULT 1, revenue_per_hour INTEGER DEFAULT 50,
    treasury INTEGER DEFAULT 0,
    employees TEXT DEFAULT '[]',
    last_collect INTEGER DEFAULT (strftime('%s','now')),
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, owner_id)
  )`).run();
} catch {}

const SECTEURS = {
  tech:       { emoji:'💻', base_revenue:80,  upgrade_cost:2000, description:'Développement logiciel & IA' },
  commerce:   { emoji:'🏪', base_revenue:60,  upgrade_cost:1500, description:'Vente de produits & commerce' },
  finance:    { emoji:'💰', base_revenue:100, upgrade_cost:3000, description:'Banque & investissements' },
  media:      { emoji:'📺', base_revenue:70,  upgrade_cost:1800, description:'Médias, YouTube & streaming' },
  alimentation:{ emoji:'🍕', base_revenue:50,  upgrade_cost:1000, description:'Restauration & food delivery' },
  immobilier: { emoji:'🏠', base_revenue:120, upgrade_cost:4000, description:'Immobilier & locations' },
  energie:    { emoji:'⚡', base_revenue:90,  upgrade_cost:2500, description:'Énergie renouvelable' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('entreprise')
    .setDescription('🏢 Gérez votre entreprise virtuelle — Embauchez, investissez, dominez !')
    .addSubcommand(s => s.setName('creer').setDescription('🏢 Créer votre entreprise')
      .addStringOption(o => o.setName('nom').setDescription('Nom de l\'entreprise').setRequired(true).setMaxLength(50))
      .addStringOption(o => o.setName('secteur').setDescription('Secteur d\'activité').setRequired(true)
        .addChoices(...Object.entries(SECTEURS).map(([k,v]) => ({ name: `${v.emoji} ${k} — ${v.description}`, value: k })))))
    .addSubcommand(s => s.setName('voir').setDescription('📊 Voir votre entreprise')
      .addUserOption(o => o.setName('membre').setDescription('Voir l\'entreprise d\'un autre')))
    .addSubcommand(s => s.setName('collecter').setDescription('💰 Collecter les revenus accumulés'))
    .addSubcommand(s => s.setName('ameliorer').setDescription('⬆️ Améliorer le niveau de l\'entreprise (+revenu)'))
    .addSubcommand(s => s.setName('embaucher').setDescription('👤 Embaucher un membre (+5% revenus par employé)')
      .addUserOption(o => o.setName('membre').setDescription('Membre à embaucher').setRequired(true)))
    .addSubcommand(s => s.setName('licencier').setDescription('👤 Licencier un employé')
      .addUserOption(o => o.setName('membre').setDescription('Membre à licencier').setRequired(true)))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Classement des entreprises les plus riches')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'creer') {
      const existing = db.db.prepare('SELECT * FROM entreprises WHERE guild_id=? AND owner_id=?').get(guildId, userId);
      if (existing) return interaction.reply({ content: '❌ Vous avez déjà une entreprise !', ephemeral: true });

      const nom = interaction.options.getString('nom');
      const secteur = interaction.options.getString('secteur');
      const s = SECTEURS[secteur];
      const cost = 1000;
      const u = db.getUser(userId, guildId);
      if ((u.balance||0) < cost) return interaction.reply({ content: `❌ Créer une entreprise coûte **${cost} ${coin}**.`, ephemeral: true });

      db.addCoins(userId, guildId, -cost);
      db.db.prepare('INSERT INTO entreprises (guild_id,owner_id,name,secteur,revenue_per_hour) VALUES(?,?,?,?,?)').run(guildId, userId, nom, secteur, s.base_revenue);

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle(`${s.emoji} ${nom} — Fondée !`)
        .setDescription(`Bienvenue dans le monde des affaires ! Votre entreprise génère **${s.base_revenue} ${coin}/heure**.`)
        .addFields({name:'💼 Secteur',value:`${s.emoji} ${secteur}`,inline:true},{name:'💰 Coût',value:`-${cost} ${coin}`,inline:true},{name:'📈 Revenu/h',value:`${s.base_revenue} ${coin}`,inline:true})
        .setFooter({text:'Utilisez /entreprise ameliorer et embaucher pour croître !'})
      ]});
    }

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const ent = db.db.prepare('SELECT * FROM entreprises WHERE guild_id=? AND owner_id=?').get(guildId, target.id);
      if (!ent) return interaction.reply({ content: `❌ **${target.username}** n'a pas d'entreprise.`, ephemeral: true });

      const s = SECTEURS[ent.secteur] || SECTEURS.tech;
      const employees = JSON.parse(ent.employees || '[]');
      const hoursElapsed = (now - ent.last_collect) / 3600;
      const pending = Math.floor(ent.revenue_per_hour * (1 + employees.length * 0.05) * hoursElapsed);
      const nextUpgradeCost = s.upgrade_cost * ent.level;

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle(`${s.emoji} ${ent.name}`)
        .setDescription(`Propriétaire : <@${target.id}>`)
        .addFields(
          {name:'💼 Secteur',value:`${s.emoji} ${ent.secteur}`,inline:true},
          {name:'📊 Niveau',value:`**${ent.level}**`,inline:true},
          {name:'📈 Revenu/h',value:`**${ent.revenue_per_hour} ${coin}**`,inline:true},
          {name:'👥 Employés',value:`**${employees.length}**`,inline:true},
          {name:'💰 Trésorerie',value:`**${ent.treasury.toLocaleString()} ${coin}**`,inline:true},
          {name:'⏳ À collecter',value:`**~${pending.toLocaleString()} ${coin}**`,inline:true},
          {name:'⬆️ Amélioration',value:`**${nextUpgradeCost.toLocaleString()} ${coin}** → +${Math.floor(ent.revenue_per_hour * 0.3)} /h`,inline:false},
        )
      ]});
    }

    if (sub === 'collecter') {
      const ent = db.db.prepare('SELECT * FROM entreprises WHERE guild_id=? AND owner_id=?').get(guildId, userId);
      if (!ent) return interaction.reply({ content: '❌ Vous n\'avez pas d\'entreprise.', ephemeral: true });

      const employees = JSON.parse(ent.employees || '[]');
      const hoursElapsed = (now - ent.last_collect) / 3600;
      if (hoursElapsed < 0.083) return interaction.reply({ content: '⏳ Attendez au moins 5 minutes avant de collecter.', ephemeral: true });

      const earned = Math.floor(ent.revenue_per_hour * (1 + employees.length * 0.05) * hoursElapsed);
      db.addCoins(userId, guildId, earned);
      db.db.prepare('UPDATE entreprises SET last_collect=?, treasury=treasury+? WHERE guild_id=? AND owner_id=?').run(now, earned, guildId, userId);

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle(`💰 Revenus collectés — ${ent.name}`)
        .setDescription(`**+${earned.toLocaleString()} ${coin}** générés en **${hoursElapsed.toFixed(1)}h** !`)
        .addFields({name:'📈 Taux',value:`${ent.revenue_per_hour} ${coin}/h × ${(1+employees.length*0.05).toFixed(2)} (bonus employés)`,inline:false})
      ]});
    }

    if (sub === 'ameliorer') {
      const ent = db.db.prepare('SELECT * FROM entreprises WHERE guild_id=? AND owner_id=?').get(guildId, userId);
      if (!ent) return interaction.reply({ content: '❌ Vous n\'avez pas d\'entreprise.', ephemeral: true });

      const s = SECTEURS[ent.secteur];
      const cost = s.upgrade_cost * ent.level;
      const u = db.getUser(userId, guildId);
      if ((u.balance||0) < cost) return interaction.reply({ content: `❌ L'amélioration coûte **${cost.toLocaleString()} ${coin}**.`, ephemeral: true });

      const revenueBonus = Math.floor(ent.revenue_per_hour * 0.3);
      db.addCoins(userId, guildId, -cost);
      db.db.prepare('UPDATE entreprises SET level=level+1, revenue_per_hour=revenue_per_hour+? WHERE guild_id=? AND owner_id=?').run(revenueBonus, guildId, userId);

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle(`⬆️ ${ent.name} — Niveau ${ent.level+1} !`)
        .addFields({name:'📈 Revenu/h',value:`+${revenueBonus} ${coin}`,inline:true},{name:'💰 Coût',value:`-${cost.toLocaleString()} ${coin}`,inline:true})
      ]});
    }

    if (sub === 'embaucher') {
      const ent = db.db.prepare('SELECT * FROM entreprises WHERE guild_id=? AND owner_id=?').get(guildId, userId);
      if (!ent) return interaction.reply({ content: '❌ Vous n\'avez pas d\'entreprise.', ephemeral: true });

      const target = interaction.options.getUser('membre');
      if (target.id === userId || target.bot) return interaction.reply({ content: '❌ Membre invalide.', ephemeral: true });

      const employees = JSON.parse(ent.employees || '[]');
      if (employees.length >= 10) return interaction.reply({ content: '❌ Maximum 10 employés.', ephemeral: true });
      if (employees.includes(target.id)) return interaction.reply({ content: '❌ Ce membre est déjà employé.', ephemeral: true });

      const salaryCost = 500;
      const u = db.getUser(userId, guildId);
      if ((u.balance||0) < salaryCost) return interaction.reply({ content: `❌ L'embauche coûte **${salaryCost} ${coin}**.`, ephemeral: true });

      employees.push(target.id);
      db.addCoins(userId, guildId, -salaryCost);
      db.db.prepare('UPDATE entreprises SET employees=? WHERE guild_id=? AND owner_id=?').run(JSON.stringify(employees), guildId, userId);

      return interaction.reply({ content: `✅ <@${target.id}> embauché(e) ! Votre entreprise génère maintenant **+5% de revenus** en plus. (${employees.length}/10 employés)` });
    }

    if (sub === 'licencier') {
      const ent = db.db.prepare('SELECT * FROM entreprises WHERE guild_id=? AND owner_id=?').get(guildId, userId);
      if (!ent) return interaction.reply({ content: '❌ Vous n\'avez pas d\'entreprise.', ephemeral: true });
      const target = interaction.options.getUser('membre');
      const employees = JSON.parse(ent.employees || '[]');
      if (!employees.includes(target.id)) return interaction.reply({ content: '❌ Ce membre n\'est pas votre employé.', ephemeral: true });
      const newEmp = employees.filter(e => e !== target.id);
      db.db.prepare('UPDATE entreprises SET employees=? WHERE guild_id=? AND owner_id=?').run(JSON.stringify(newEmp), guildId, userId);
      return interaction.reply({ content: `✅ <@${target.id}> a été licencié(e). (${newEmp.length}/10 employés)` });
    }

    if (sub === 'top') {
      const top = db.db.prepare('SELECT * FROM entreprises WHERE guild_id=? ORDER BY treasury DESC LIMIT 10').all(guildId);
      if (!top.length) return interaction.reply({ content: '❌ Aucune entreprise sur ce serveur.', ephemeral: true });
      const desc = top.map((e, i) => {
        const s = SECTEURS[e.secteur] || {};
        return `${['🥇','🥈','🥉'][i]||`**${i+1}.**`} ${s.emoji||'🏢'} **${e.name}** (<@${e.owner_id}>) — Niv.${e.level} • ${e.treasury.toLocaleString()} ${coin} au total`;
      }).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle('🏢 Top Entreprises').setDescription(desc)] });
    }
  }
};
