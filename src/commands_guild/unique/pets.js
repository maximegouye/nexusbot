/**
 * NexusBot — Système d'animaux de compagnie virtuels
 * UNIQUE : évolution, émotions, maladies, combats, races rares
 */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

const PETS = {
  chien:    { emoji:'🐶', rarity:'commun',    baseStats:{hp:100,atk:15,def:10}, evolutions:['chiot','chien','chien_adulte','chien_alpha'] },
  chat:     { emoji:'🐱', rarity:'commun',    baseStats:{hp:80,atk:20,def:8},  evolutions:['chaton','chat','chat_ninja','chat_mythique'] },
  dragon:   { emoji:'🐲', rarity:'légendaire',baseStats:{hp:200,atk:50,def:30},evolutions:['dragonnet','dragon','dragon_adulte','dragon_ancien'] },
  lapin:    { emoji:'🐰', rarity:'commun',    baseStats:{hp:70,atk:10,def:15}, evolutions:['lapineau','lapin','lapin_géant','lapin_cosmique'] },
  renard:   { emoji:'🦊', rarity:'rare',      baseStats:{hp:90,atk:25,def:12}, evolutions:['renardeau','renard','renard_espion','renard_fantôme'] },
  licorne:  { emoji:'🦄', rarity:'épique',    baseStats:{hp:150,atk:35,def:25},evolutions:['poulain','licorne','licorne_arc-en-ciel','licorne_divine'] },
  pingouin: { emoji:'🐧', rarity:'rare',      baseStats:{hp:95,atk:18,def:20}, evolutions:['poussin','pingouin','pingouin_chef','pingouin_ninja'] },
  robot:    { emoji:'🤖', rarity:'épique',    baseStats:{hp:180,atk:40,def:35},evolutions:['robot_v1','robot_v2','robot_v3','robot_ultime'] },
};

// 🎲 Prénoms thématiques aléatoires par type d'animal
const PET_NAMES = {
  chien:    ['Rex','Buddy','Max','Charlie','Rocky','Bailey','Cooper','Tucker','Duke','Jack','Toby','Oliver','Bear','Leo','Milo','Riley','Zeus','Loki','Apollo','Thor','Atlas','Bandit','Shadow','Diesel','Ranger','Scout','Bruno','Luna','Bella','Daisy','Nala','Coco','Lucy','Sadie'],
  chat:     ['Luna','Bella','Lucy','Lily','Nala','Chloé','Stella','Cléo','Mia','Olive','Pixie','Misty','Ginger','Pepper','Pumpkin','Whiskers','Mittens','Tigger','Felix','Salem','Simba','Garfield','Tom','Oscar','Boots','Smokey','Patches','Snowball','Mocha','Caramel','Saphir','Onyx'],
  dragon:   ['Drakkar','Pyrosvale','Inferno','Ignis','Vulcan','Khaal','Mordor','Smaug','Bahamut','Tiamat','Glaurung','Nidhögg','Falkor','Toothless','Dracarys','Nargacuga','Charizard','Drogon','Rhaegal','Viserion','Saphira','Spyro','Daenerys','Eragon','Fafnir','Jormungandr','Kalessin','Norbert','Maleficent','Ouroboros','Quetzalcoatl','Vermithrax'],
  lapin:    ['Coton','Caramel','Choco','Vanille','Mochi','Pompom','Praline','Truffe','Marshmallow','Biscuit','Gingembre','Pancake','Brownie','Toffee','Cookie','Donut','Crumpet','Bonbon','Sucre','Pelote','Nuage','Flocon','Boule','Câlin','Sirop','Patate','Carotte','Lapinou','Daisy','Olympe','Hop','Bunny'],
  renard:   ['Rusé','Vega','Ash','Foxy','Tails','Ember','Cinder','Ruby','Saphir','Jasper','Onyx','Mystique','Spectre','Phantom','Astro','Star','Comet','Nova','Eclipse','Solar','Lunaire','Aurora','Boreal','Wisp','Whisper','Echo','Shadow','Silver','Copper','Bronze','Gold','Cosmo'],
  licorne:  ['Étoile','Arc-en-Ciel','Stardust','Celeste','Aurora','Cristal','Diamant','Saphir','Rubis','Améthyste','Opale','Perle','Lumière','Iris','Galaxie','Magie','Féerie','Espoir','Joie','Rêve','Souhait','Souffle','Murmure','Brise','Comète','Nova','Sirius','Vega','Lyra','Pegasus','Pénélope','Daisy'],
  pingouin: ['Pingu','Tux','Frosty','Snowball','Iceberg','Glacier','Blizzard','Polar','Arctic','Penny','Pip','Pebble','Cube','Slip','Slide','Waddle','Tuxedo','Domino','Oreo','Pancake','Captain','Admiral','Skipper','Kowalski','Rico','Private','Mumble','Lovelace','Erik','Boots','Berg','Frost'],
  robot:    ['Mark-I','R2-D2','C-3PO','BB-8','Wall-E','Eve','HAL','Bender','Optimus','Megatron','Bumblebee','Sentinel','Cypher','Vector','Pixel','Byte','Glitch','Neon','Helix','Omega','Alpha','Beta','Gamma','Delta','Sigma','Atlas','Forge','Ion','Photon','Quantum','Nexus','Spark'],
};

function generateRandomName(type) {
  const pool = PET_NAMES[type] || PET_NAMES.chien;
  return pool[Math.floor(Math.random() * pool.length)];
}

const RARITY_COLORS = { commun:'#95A5A6', rare:'#3498DB', épique:'#9B59B6', légendaire:'#F1C40F' };
const RARITY_CHANCE = { commun:0.55, rare:0.30, épique:0.12, légendaire:0.03 };

const FOODS = {
  croquettes: { price:50,  hunger:30, happiness:5,  xp:10 },
  viande:     { price:150, hunger:60, happiness:15, xp:25 },
  festin:     { price:500, hunger:100,happiness:30, xp:60 },
  bonbon:     { price:30,  hunger:10, happiness:25, xp:5  },
  potion_xp:  { price:300, hunger:0,  happiness:10, xp:100},
};

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT, name TEXT,
    type TEXT, emoji TEXT, rarity TEXT,
    level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 100, max_hp INTEGER DEFAULT 100,
    atk INTEGER DEFAULT 15, def INTEGER DEFAULT 10,
    hunger INTEGER DEFAULT 100,
    happiness INTEGER DEFAULT 100,
    evolution_stage INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0,
    last_fed INTEGER DEFAULT 0,
    last_played INTEGER DEFAULT 0,
    last_battle INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

function getPetStatus(pet) {
  if (pet.happiness < 20) return '😢 Très malheureux';
  if (pet.hunger < 20) return '😫 Affamé';
  if (pet.happiness > 80 && pet.hunger > 80) return '😊 Heureux';
  return '😐 Normal';
}

function xpForLevel(level) { return level * 100 + level * 50; }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pet')
    .setDescription('🐾 Système d\'animaux de compagnie — Adoptez, élevez, combattez !')
    .addSubcommand(s => s.setName('adopter').setDescription('🥚 Adopter un animal (prénom auto-généré thématique)')
      .addStringOption(o => o.setName('type').setDescription('Type d\'animal (laisse vide = aléatoire)').setRequired(false)
        .addChoices(...Object.keys(PETS).map(k => ({ name: `${PETS[k].emoji} ${k} (${PETS[k].rarity})`, value: k }))))
      .addStringOption(o => o.setName('nom').setDescription('Prénom personnalisé (optionnel — auto si vide)').setRequired(false).setMaxLength(20)))
    .addSubcommand(s => s.setName('voir').setDescription('👁️ Voir votre animal')
      .addUserOption(o => o.setName('membre').setDescription('Voir l\'animal d\'un autre membre')))
    .addSubcommand(s => s.setName('nourrir').setDescription('🍖 Nourrir votre animal')
      .addStringOption(o => o.setName('nourriture').setDescription('Type de nourriture').setRequired(true)
        .addChoices(...Object.entries(FOODS).map(([k,v]) => ({ name: `${k} (${v.price}🪙 +${v.hunger} faim)`, value: k })))))
    .addSubcommand(s => s.setName('jouer').setDescription('🎾 Jouer avec votre animal (+bonheur)'))
    .addSubcommand(s => s.setName('entrainer').setDescription('⚔️ Entraîner votre animal (+ATK/DEF)'))
    .addSubcommand(s => s.setName('combat').setDescription('⚔️ Défier l\'animal d\'un autre membre')
      .addUserOption(o => o.setName('adversaire').setDescription('Membre dont vous voulez affronter l\'animal').setRequired(true)))
    .addSubcommand(s => s.setName('evoluer').setDescription('✨ Faire évoluer votre animal (si niveau requis atteint)'))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Classement des animaux les plus forts'))
    .addSubcommand(s => s.setName('abandonner').setDescription('💔 Abandonner votre animal (irréversible)')),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'adopter') {
      const existing = db.db.prepare('SELECT * FROM pets WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (existing) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous avez déjà un animal ! Utilisez `/pet voir` ou `/pet abandonner`.', ephemeral: true });

      let type = interaction.options.getString('type');
      let customName = interaction.options.getString('nom');

      if (!type) {
        // Tirage aléatoire selon les chances
        const roll = Math.random();
        let cumul = 0;
        for (const [t, data] of Object.entries(PETS)) {
          cumul += RARITY_CHANCE[data.rarity];
          if (roll < cumul) { type = t; break; }
        }
        type = type || 'chien';
      }

      // 🎲 Si pas de nom personnalisé, génère un nom thématique aléatoire
      const nom = customName ? customName.trim() : generateRandomName(type);
      const wasGenerated = !customName;

      const petData = PETS[type];
      const cost = petData.rarity === 'légendaire' ? 5000 : petData.rarity === 'épique' ? 2000 : petData.rarity === 'rare' ? 500 : 100;
      const u = db.getUser(userId, guildId);
      if ((u.balance||0) < cost) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Adopter un **${type}** (${petData.rarity}) coûte **${cost} ${coin}**. Votre solde : ${u.balance||0} ${coin}`, ephemeral: true });

      db.addCoins(userId, guildId, -cost);
      db.db.prepare('INSERT INTO pets (guild_id,user_id,name,type,emoji,rarity,hp,max_hp,atk,def) VALUES(?,?,?,?,?,?,?,?,?,?)').run(guildId, userId, nom, type, petData.emoji, petData.rarity, petData.baseStats.hp, petData.baseStats.hp, petData.baseStats.atk, petData.baseStats.def);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor(RARITY_COLORS[petData.rarity])
        .setTitle(`${petData.emoji} ${nom} vous a rejoint !`)
        .setDescription(`Vous avez adopté un **${type}** de rareté **${petData.rarity}** !${wasGenerated ? `\n\n🎲 *Prénom thématique généré aléatoirement.*` : ''}`)
        .addFields(
          { name: '❤️ HP', value: `${petData.baseStats.hp}`, inline: true },
          { name: '⚔️ ATK', value: `${petData.baseStats.atk}`, inline: true },
          { name: '🛡️ DEF', value: `${petData.baseStats.def}`, inline: true },
          { name: '💰 Coût', value: `-${cost} ${coin}`, inline: true },
        )
        .setFooter({ text: 'Nourrissez-le et entraînez-le pour qu\'il évolue !' })
      ]});
    }

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const pet = db.db.prepare('SELECT * FROM pets WHERE guild_id=? AND user_id=?').get(guildId, target.id);
      if (!pet) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ **${target.username}** n'a pas d'animal. Adoptez-en un avec \`/pet adopter\` !`, ephemeral: true });

      const petMeta = PETS[pet.type];
      const evolName = petMeta?.evolutions?.[pet.evolution_stage] || pet.type;
      const xpNext = xpForLevel(pet.level);
      const pct = Math.min(Math.floor(pet.xp / xpNext * 100), 100);
      const hungerBar = '█'.repeat(Math.floor(pet.hunger/10)) + '░'.repeat(10-Math.floor(pet.hunger/10));
      const happyBar = '█'.repeat(Math.floor(pet.happiness/10)) + '░'.repeat(10-Math.floor(pet.happiness/10));

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor(RARITY_COLORS[pet.rarity])
        .setTitle(`${pet.emoji} ${pet.name} (${evolName})`)
        .setDescription(`Propriétaire : <@${target.id}> • Statut : ${getPetStatus(pet)}`)
        .addFields(
          { name: '⭐ Niveau', value: `**${pet.level}** (${pet.xp}/${xpNext} XP)`, inline: true },
          { name: '🏅 Rareté', value: `**${pet.rarity}**`, inline: true },
          { name: '⚔️ ATK / 🛡️ DEF', value: `**${pet.atk} / ${pet.def}**`, inline: true },
          { name: '❤️ HP', value: `**${pet.hp}/${pet.max_hp}**`, inline: true },
          { name: '🏆 Victoires', value: `**${pet.wins}W / ${pet.losses}L**`, inline: true },
          { name: '🍖 Faim', value: `\`[${hungerBar}]\` ${pet.hunger}%`, inline: false },
          { name: '😊 Bonheur', value: `\`[${happyBar}]\` ${pet.happiness}%`, inline: false },
        )
      ]});
    }

    if (sub === 'nourrir') {
      const pet = db.db.prepare('SELECT * FROM pets WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!pet) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'avez pas d\'animal. `/pet adopter`', ephemeral: true });

      const foodKey = interaction.options.getString('nourriture');
      const food = FOODS[foodKey];
      const u = db.getUser(userId, guildId);
      if ((u.balance||0) < food.price) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ **${foodKey}** coûte **${food.price} ${coin}**.`, ephemeral: true });

      const cdLeft = 300 - (now - (pet.last_fed||0));
      if (cdLeft > 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `⏳ Votre animal n'a pas encore faim ! Attendez **${Math.ceil(cdLeft/60)} min**.`, ephemeral: true });

      db.addCoins(userId, guildId, -food.price);
      const newHunger = Math.min(100, pet.hunger + food.hunger);
      const newHappy = Math.min(100, pet.happiness + food.happiness);
      const newXp = pet.xp + food.xp;
      let newLevel = pet.level;
      while (newXp >= xpForLevel(newLevel)) newLevel++;

      db.db.prepare('UPDATE pets SET hunger=?,happiness=?,xp=?,level=?,last_fed=? WHERE guild_id=? AND user_id=?').run(newHunger, newHappy, newXp, newLevel, now, guildId, userId);

      const leveled = newLevel > pet.level;
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('#2ECC71').setTitle(`🍖 ${pet.name} a mangé !`)
        .setDescription(`**${foodKey}** servi !${leveled ? `\n\n🎉 **NIVEAU ${newLevel} ATTEINT !**` : ''}`)
        .addFields(
          { name: '🍖 Faim', value: `${pet.hunger}% → ${newHunger}%`, inline: true },
          { name: '😊 Bonheur', value: `${pet.happiness}% → ${newHappy}%`, inline: true },
          { name: '✨ XP', value: `+${food.xp} XP`, inline: true },
        )
      ]});
    }

    if (sub === 'jouer') {
      const pet = db.db.prepare('SELECT * FROM pets WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!pet) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'avez pas d\'animal.', ephemeral: true });
      const cdLeft = 1800 - (now - (pet.last_played||0));
      if (cdLeft > 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `⏳ Votre animal est fatigué ! Revenez dans **${Math.ceil(cdLeft/60)} min**.`, ephemeral: true });

      const xpGain = Math.floor(Math.random() * 30) + 20;
      const happyGain = Math.floor(Math.random() * 20) + 10;
      const newHappy = Math.min(100, pet.happiness + happyGain);
      const newXp = pet.xp + xpGain;
      let newLevel = pet.level;
      while (newXp >= xpForLevel(newLevel)) newLevel++;
      db.db.prepare('UPDATE pets SET happiness=?,xp=?,level=?,last_played=? WHERE guild_id=? AND user_id=?').run(newHappy, newXp, newLevel, now, guildId, userId);
      const activities = ['joué à la balle','couru dans le jardin','sauté partout','chassé des papillons','fait des tours'];
      const act = activities[Math.floor(Math.random()*activities.length)];
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle(`🎾 ${pet.name} a ${act} !`).addFields({name:'😊 Bonheur',value:`+${happyGain}% → ${newHappy}%`,inline:true},{name:'✨ XP',value:`+${xpGain}`,inline:true})] });
    }

    if (sub === 'entrainer') {
      const pet = db.db.prepare('SELECT * FROM pets WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!pet) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Pas d\'animal.', ephemeral: true });
      const cdLeft = 3600 - (now - (pet.last_battle||0));
      if (cdLeft > 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `⏳ Votre animal est épuisé ! Revenez dans **${Math.ceil(cdLeft/60)} min**.`, ephemeral: true });
      const atkGain = Math.floor(Math.random()*3)+1;
      const defGain = Math.floor(Math.random()*3)+1;
      const xpGain = 50;
      let newLevel = pet.level;
      const newXp = pet.xp + xpGain;
      while (newXp >= xpForLevel(newLevel)) newLevel++;
      db.db.prepare('UPDATE pets SET atk=atk+?,def=def+?,xp=?,level=?,last_battle=? WHERE guild_id=? AND user_id=?').run(atkGain, defGain, newXp, newLevel, now, guildId, userId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle(`⚔️ ${pet.name} s'est entraîné !`).addFields({name:'⚔️ ATK',value:`+${atkGain}`,inline:true},{name:'🛡️ DEF',value:`+${defGain}`,inline:true},{name:'✨ XP',value:`+${xpGain}`,inline:true})] });
    }

    if (sub === 'combat') {
      const opponent = interaction.options.getUser('adversaire');
      if (opponent.id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne pouvez pas vous battre contre vous-même.', ephemeral: true });
      const myPet = db.db.prepare('SELECT * FROM pets WHERE guild_id=? AND user_id=?').get(guildId, userId);
      const theirPet = db.db.prepare('SELECT * FROM pets WHERE guild_id=? AND user_id=?').get(guildId, opponent.id);
      if (!myPet) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'avez pas d\'animal.', ephemeral: true });
      if (!theirPet) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ <@${opponent.id}> n'a pas d'animal.`, ephemeral: true });

      // Simuler le combat
      let myHp = myPet.hp, theirHp = theirPet.hp;
      const log = [];
      let turn = 0;
      while (myHp > 0 && theirHp > 0 && turn < 20) {
        const myDmg = Math.max(1, myPet.atk - Math.floor(theirPet.def / 3) + Math.floor(Math.random()*10));
        const theirDmg = Math.max(1, theirPet.atk - Math.floor(myPet.def / 3) + Math.floor(Math.random()*10));
        theirHp -= myDmg;
        if (theirHp <= 0) break;
        myHp -= theirDmg;
        turn++;
      }

      const iWin = theirHp <= 0 || myHp > theirHp;
      const winner = iWin ? myPet : theirPet;
      const loser = iWin ? theirPet : myPet;
      const winnerId = iWin ? userId : opponent.id;
      const loserId = iWin ? opponent.id : userId;

      db.db.prepare('UPDATE pets SET wins=wins+1,xp=xp+80 WHERE guild_id=? AND user_id=?').run(guildId, winnerId);
      db.db.prepare('UPDATE pets SET losses=losses+1,xp=xp+20 WHERE guild_id=? AND user_id=?').run(guildId, loserId);
      db.addCoins(winnerId, guildId, 300);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor(iWin ? '#2ECC71' : '#E74C3C')
        .setTitle(`⚔️ Combat : ${myPet.name} vs ${theirPet.name}`)
        .setDescription(`**${iWin ? myPet.name : theirPet.name}** remporte le combat !\n<@${winnerId}> gagne **+300 ${coin}** et +80 XP !`)
        .addFields(
          { name: `${myPet.emoji} ${myPet.name}`, value: `HP restants: ${Math.max(0,myHp)}`, inline: true },
          { name: `${theirPet.emoji} ${theirPet.name}`, value: `HP restants: ${Math.max(0,theirHp)}`, inline: true },
        )
      ]});
    }

    if (sub === 'evoluer') {
      const pet = db.db.prepare('SELECT * FROM pets WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!pet) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Pas d\'animal.', ephemeral: true });
      const petMeta = PETS[pet.type];
      const maxStage = (petMeta?.evolutions?.length || 4) - 1;
      if (pet.evolution_stage >= maxStage) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '✨ Votre animal est déjà à son évolution maximale !', ephemeral: true });
      const levelReq = (pet.evolution_stage + 1) * 10;
      if (pet.level < levelReq) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Niveau **${levelReq}** requis pour évoluer. Vous êtes niveau **${pet.level}**.`, ephemeral: true });

      const newStage = pet.evolution_stage + 1;
      const newName = petMeta?.evolutions?.[newStage] || pet.type;
      const atkBonus = 10 + newStage * 5;
      const defBonus = 8 + newStage * 4;
      const hpBonus = 30 + newStage * 20;
      db.db.prepare('UPDATE pets SET evolution_stage=?,atk=atk+?,def=def+?,max_hp=max_hp+?,hp=hp+? WHERE guild_id=? AND user_id=?').run(newStage, atkBonus, defBonus, hpBonus, hpBonus, guildId, userId);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('#FFD700').setTitle(`✨ ${pet.name} a évolué !`)
        .setDescription(`${pet.emoji} **${pet.name}** est maintenant un **${newName}** !`)
        .addFields({name:'⚔️ ATK',value:`+${atkBonus}`,inline:true},{name:'🛡️ DEF',value:`+${defBonus}`,inline:true},{name:'❤️ HP Max',value:`+${hpBonus}`,inline:true})
      ]});
    }

    if (sub === 'top') {
      const top = db.db.prepare('SELECT * FROM pets WHERE guild_id=? ORDER BY wins DESC, level DESC LIMIT 10').all(guildId);
      if (!top.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun animal sur ce serveur.', ephemeral: true });
      const desc = top.map((p, i) => `${['🥇','🥈','🥉'][i]||`**${i+1}.**`} ${p.emoji} **${p.name}** (<@${p.user_id}>) — Niv.**${p.level}** • ${p.wins}W/${p.losses}L • ${p.rarity}`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle('🏆 Top Animaux').setDescription(desc)] });
    }

    if (sub === 'abandonner') {
      const pet = db.db.prepare('SELECT * FROM pets WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!pet) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'avez pas d\'animal.', ephemeral: true });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`pet_abandon_confirm_${userId}`).setLabel('💔 Confirmer l\'abandon').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`pet_abandon_cancel_${userId}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
      );
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('⚠️ Abandon').setDescription(`Êtes-vous sûr de vouloir abandonner **${pet.name}** ? Cette action est **irréversible**.`)], components: [row], ephemeral: true });
    }
  }
};

async function handleComponent(interaction, customId) {
  if (!customId.startsWith('pet_')) return false;

  if (customId.includes('abandon_confirm')) {
    const userId = customId.split('_')[3] || customId.split('_')[2];
    if (interaction.user.id !== userId) {
      await interaction.editReply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    db.db.prepare('DELETE FROM pets WHERE guild_id=? AND user_id=?').run(interaction.guildId, interaction.user.id);
    await interaction.update({ content: '💔 Votre animal a été abandonné.', components: [] }).catch(() => {});
  } else if (customId.includes('abandon_cancel')) {
    const userId = customId.split('_')[3] || customId.split('_')[2];
    if (interaction.user.id !== userId) {
      await interaction.editReply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.update({ content: '✅ Abandon annulé.', components: [] }).catch(() => {});
  }

  return true;
}

module.exports.handleComponent = handleComponent;
