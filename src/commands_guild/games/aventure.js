// ============================================================
// aventure.js — Système d'aventure narrative + exploration
// Complémentaire à /rpg : exploration de zones, encounters aléatoires
// avec choix multiples (boutons), combat, loot, progression.
// Style "best-in-class" : Roleplay bot, AdventureBot, EpicRPG.
// ============================================================
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');

// ── Migrations ───────────────────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS aventure_chars (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    attack INTEGER DEFAULT 10,
    defense INTEGER DEFAULT 5,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    gold INTEGER DEFAULT 50,
    inventory TEXT DEFAULT '[]',
    explored_zones TEXT DEFAULT '[]',
    monsters_killed INTEGER DEFAULT 0,
    bosses_killed INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    last_explored INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  )`).run();
} catch {}

// ── Zones d'exploration ──────────────────────────────────────
const ZONES = {
  foret: {
    name: '🌲 Forêt Sombre',     minLvl: 1,  color: '#27AE60',
    desc: 'Une forêt ancestrale où des créatures mystérieuses rôdent...',
    monsters: [
      { name: 'Loup affamé',     emoji:'🐺', hp:30,  atk:8,  xp:25,  gold:20  },
      { name: 'Gobelin filou',   emoji:'👺', hp:40,  atk:10, xp:35,  gold:30  },
      { name: 'Sanglier furieux',emoji:'🐗', hp:50,  atk:12, xp:45,  gold:40  },
    ],
    boss: { name:"L'Ours Géant", emoji:'🐻', hp:200, atk:25, xp:300, gold:500 },
  },
  montagnes: {
    name: '🏔️ Montagnes Glacées', minLvl: 5,  color: '#5DADE2',
    desc: 'Des sommets enneigés où le froid mordant cache des dangers anciens...',
    monsters: [
      { name: 'Yéti des neiges',  emoji:'❄️', hp:80,  atk:18, xp:80,  gold:70  },
      { name: 'Aigle royal',      emoji:'🦅', hp:60,  atk:22, xp:90,  gold:80  },
      { name: 'Troll des cavernes',emoji:'👹',hp:120, atk:20, xp:110, gold:100 },
    ],
    boss: { name:'Dragon de Glace', emoji:'🐉', hp:500, atk:45, xp:800, gold:1500 },
  },
  desert: {
    name: '🏜️ Désert Maudit',     minLvl: 10, color: '#F39C12',
    desc: 'Sables brûlants hantés par des esprits anciens et des bandits...',
    monsters: [
      { name: 'Scorpion géant',   emoji:'🦂', hp:120, atk:30, xp:180, gold:150 },
      { name: 'Momie maudite',    emoji:'🧟', hp:150, atk:28, xp:200, gold:170 },
      { name: 'Bandit du désert', emoji:'🥷', hp:140, atk:35, xp:220, gold:200 },
    ],
    boss: { name:'Pharaon Démon', emoji:'⚱️', hp:900, atk:70, xp:1500, gold:3000 },
  },
  ile: {
    name: '🌊 Île aux Pirates',   minLvl: 15, color: '#1ABC9C',
    desc: 'Une île tropicale infestée de pirates et de monstres marins...',
    monsters: [
      { name: 'Kraken juvénile',  emoji:'🦑', hp:200, atk:45, xp:350, gold:300 },
      { name: 'Pirate maudit',    emoji:'🏴‍☠️', hp:180, atk:50, xp:380, gold:330 },
      { name: 'Requin de feu',    emoji:'🦈', hp:220, atk:55, xp:420, gold:380 },
    ],
    boss: { name:'Capitaine Démon', emoji:'☠️', hp:1500, atk:100, xp:3000, gold:6000 },
  },
  volcan: {
    name: '🌋 Volcan en Éruption', minLvl: 20, color: '#E74C3C',
    desc: 'Un volcan en activité où la lave et les démons règnent en maîtres...',
    monsters: [
      { name: 'Élémentaire de lave', emoji:'🔥', hp:300, atk:70, xp:600, gold:500 },
      { name: 'Démon mineur',        emoji:'😈', hp:280, atk:80, xp:650, gold:550 },
      { name: 'Phénix corrompu',     emoji:'🔥', hp:320, atk:75, xp:700, gold:600 },
    ],
    boss: { name:'Seigneur du Feu', emoji:'👹', hp:2500, atk:150, xp:6000, gold:12000 },
  },
  astral: {
    name: '🌌 Royaume Astral',    minLvl: 30, color: '#8E44AD',
    desc: 'Un plan dimensionnel où la réalité elle-même se déforme...',
    monsters: [
      { name: 'Voidwalker',       emoji:'👁️', hp:500,  atk:120, xp:1200, gold:1000 },
      { name: 'Ange déchu',       emoji:'😇', hp:550,  atk:130, xp:1300, gold:1100 },
      { name: 'Cauchemar primordial', emoji:'💀', hp:600, atk:140, xp:1500, gold:1300 },
    ],
    boss: { name:'Dieu du Vide', emoji:'⚜️', hp:5000, atk:300, xp:15000, gold:30000 },
  },
};

// ── Items boutique ───────────────────────────────────────────
const SHOP_ITEMS = {
  potion_legere: { name:'Potion légère', emoji:'🧪', cost:50,    effect:{ type:'heal', value:30 },  desc:'+30 PV' },
  potion_max:    { name:'Potion max',    emoji:'⚗️', cost:200,   effect:{ type:'heal', value:9999}, desc:'PV au max' },
  epee_ancestrale:{name:'Épée ancestrale',emoji:'⚔️',cost:1000,  effect:{ type:'atk', value:15 },    desc:'+15 ATK perm.' },
  bouclier_acier:{ name:'Bouclier acier',emoji:'🛡️',cost:800,    effect:{ type:'def', value:12 },    desc:'+12 DEF perm.' },
  amulette_vie:  { name:'Amulette de vie',emoji:'📿',cost:1500,  effect:{ type:'maxhp', value:50 },  desc:'+50 PV max' },
  parchemin_xp:  { name:'Parchemin XP',  emoji:'📜', cost:500,   effect:{ type:'xp', value:200 },    desc:'+200 XP instant' },
};

// ── Helpers DB ───────────────────────────────────────────────
function getChar(guildId, userId) {
  return db.db.prepare('SELECT * FROM aventure_chars WHERE guild_id=? AND user_id=?').get(guildId, userId);
}

function createChar(guildId, userId) {
  db.db.prepare(`INSERT OR IGNORE INTO aventure_chars (guild_id, user_id) VALUES (?, ?)`)
    .run(guildId, userId);
  return getChar(guildId, userId);
}

function updateChar(guildId, userId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sql = `UPDATE aventure_chars SET ${keys.map(k => `${k}=?`).join(', ')} WHERE guild_id=? AND user_id=?`;
  db.db.prepare(sql).run(...keys.map(k => fields[k]), guildId, userId);
}

function xpForLevel(lvl) { return Math.floor(100 * Math.pow(1.4, lvl - 1)); }

function checkLevelUp(char) {
  let leveled = 0;
  while (char.xp >= xpForLevel(char.level)) {
    char.xp -= xpForLevel(char.level);
    char.level += 1;
    char.max_hp += 15;
    char.attack += 3;
    char.defense += 2;
    char.hp = char.max_hp; // soin complet à la montée de niveau
    leveled++;
  }
  return leveled;
}

// ── Sessions de combat actives (in-memory) ───────────────────
const battles = new Map(); // userId → { monster, charSnapshot, zone }

// ── HUD perso ────────────────────────────────────────────────
function buildCharEmbed(char, title = '🧙 Ton Aventurier') {
  const xpNeeded = xpForLevel(char.level);
  const xpBar = Math.min(20, Math.floor((char.xp / xpNeeded) * 20));
  const hpPct = Math.max(0, char.hp / char.max_hp);
  const hpBar = Math.floor(hpPct * 20);
  return new EmbedBuilder()
    .setColor(hpPct > 0.5 ? '#2ECC71' : hpPct > 0.25 ? '#F39C12' : '#E74C3C')
    .setTitle(title)
    .addFields(
      { name:'❤️ PV',     value:`**${char.hp}/${char.max_hp}** ${'❤'.repeat(Math.max(0,hpBar))}${'🖤'.repeat(20-Math.max(0,hpBar))}`, inline:false },
      { name:'⭐ Niveau',  value:`**${char.level}** (${char.xp}/${xpNeeded} XP)\n${'⬜'.repeat(xpBar)}${'⬛'.repeat(20-xpBar)}`, inline:false },
      { name:'⚔️ ATK',    value:`${char.attack}`, inline:true },
      { name:'🛡️ DEF',    value:`${char.defense}`, inline:true },
      { name:'💰 Or',     value:`${char.gold.toLocaleString('fr-FR')}`, inline:true },
      { name:'☠️ Monstres tués',  value:`${char.monsters_killed}`, inline:true },
      { name:'👑 Boss vaincus',   value:`${char.bosses_killed}`,   inline:true },
      { name:'💀 Morts',          value:`${char.deaths}`,           inline:true },
    )
    .setFooter({ text:'Aventure · Zone Entraide' });
}

// ── Encounter aléatoire dans une zone ────────────────────────
function rollEncounter(zoneKey) {
  const zone = ZONES[zoneKey];
  if (!zone) return null;
  const r = Math.random();
  // 60% monstre, 25% trésor, 10% rien (texte ambiance), 5% boss
  if (r < 0.60) {
    const m = zone.monsters[Math.floor(Math.random() * zone.monsters.length)];
    return { type:'monster', monster: { ...m, currentHp: m.hp }, zone };
  } else if (r < 0.85) {
    const goldFound = Math.floor((zone.minLvl + 1) * (10 + Math.random() * 30));
    return { type:'treasure', gold: goldFound, zone };
  } else if (r < 0.95) {
    const ambiances = [
      "Tu marches en silence... rien ne se passe.",
      "Le vent souffle. Une feuille tombe.",
      "Tu entends un bruit lointain, mais c'est juste le vent.",
      "Tu trouves des traces de pas anciennes — quelqu'un est passé par là.",
      "Une étrange lueur apparaît au loin puis disparaît.",
    ];
    return { type:'ambiance', text: ambiances[Math.floor(Math.random()*ambiances.length)], zone };
  } else {
    return { type:'boss', monster: { ...zone.boss, currentHp: zone.boss.hp }, zone };
  }
}

// ── Boutons combat ───────────────────────────────────────────
function combatButtons(userId, monsterIdx) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`av_attack_${userId}_${monsterIdx}`).setLabel('Attaquer').setEmoji('⚔️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`av_potion_${userId}_${monsterIdx}`).setLabel('Potion').setEmoji('🧪').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`av_flee_${userId}_${monsterIdx}`).setLabel('Fuir').setEmoji('🏃').setStyle(ButtonStyle.Secondary),
  );
}

// ── Slash command ────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('aventure')
    .setDescription('🗡️ Système d\'aventure : explore, combats, devient légende')
    .addSubcommand(s => s.setName('profil').setDescription('🧙 Voir ton aventurier'))
    .addSubcommand(s => s.setName('explorer')
      .setDescription('🗺️ Explorer une zone (encounter aléatoire)')
      .addStringOption(o => o.setName('zone').setDescription('Zone à explorer').setRequired(true)
        .addChoices(...Object.entries(ZONES).map(([k,z]) => ({ name: `${z.name} (lvl ${z.minLvl}+)`, value: k })))))
    .addSubcommand(s => s.setName('carte').setDescription('🗺️ Voir toutes les zones'))
    .addSubcommand(s => s.setName('boutique').setDescription('🛒 Acheter des items'))
    .addSubcommand(s => s.setName('inventaire').setDescription('🎒 Voir ton inventaire'))
    .addSubcommand(s => s.setName('soigner').setDescription('💊 Te soigner avec une potion'))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Top 10 des aventuriers')),

  ephemeral: false,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;
    let char = getChar(guildId, userId);
    if (!char) char = createChar(guildId, userId);

    // ── /aventure profil
    if (sub === 'profil') {
      return interaction.editReply({ embeds: [buildCharEmbed(char)] });
    }

    // ── /aventure carte
    if (sub === 'carte') {
      const lines = Object.entries(ZONES).map(([k, z]) => {
        const locked = char.level < z.minLvl;
        return `${locked ? '🔒' : '✅'} **${z.name}** — *${z.desc}*\n   Niveau requis : **${z.minLvl}**`;
      }).join('\n\n');
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#3498DB')
          .setTitle('🗺️ Carte du Monde')
          .setDescription(`Tu es **niveau ${char.level}**. Voici les zones disponibles :\n\n${lines}`)
          .setFooter({ text:'Utilise /aventure explorer pour partir !' })],
      });
    }

    // ── /aventure boutique
    if (sub === 'boutique') {
      const lines = Object.entries(SHOP_ITEMS).map(([id, item]) =>
        `${item.emoji} **${item.name}** — ${item.cost.toLocaleString('fr-FR')} or — *${item.desc}*\n   \`/aventure inventaire\` puis utilise l'item`
      ).join('\n\n');
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#9B59B6')
          .setTitle('🛒 Boutique de l\'Aventurier')
          .setDescription(`Tu as **${char.gold.toLocaleString('fr-FR')} or**.\n\n${lines}\n\n*Utilise les boutons ci-dessous pour acheter rapidement.*`)],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`av_buy_${userId}_potion_legere`).setLabel('Potion 50').setEmoji('🧪').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`av_buy_${userId}_potion_max`).setLabel('Potion Max 200').setEmoji('⚗️').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`av_buy_${userId}_parchemin_xp`).setLabel('XP +200 (500)').setEmoji('📜').setStyle(ButtonStyle.Primary),
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`av_buy_${userId}_epee_ancestrale`).setLabel('Épée 1000').setEmoji('⚔️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`av_buy_${userId}_bouclier_acier`).setLabel('Bouclier 800').setEmoji('🛡️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`av_buy_${userId}_amulette_vie`).setLabel('Amulette 1500').setEmoji('📿').setStyle(ButtonStyle.Danger),
          ),
        ],
      });
    }

    // ── /aventure inventaire
    if (sub === 'inventaire') {
      let inv; try { inv = JSON.parse(char.inventory); } catch { inv = []; }
      const lines = inv.length
        ? inv.map(i => `${SHOP_ITEMS[i]?.emoji || '📦'} **${SHOP_ITEMS[i]?.name || i}** — *${SHOP_ITEMS[i]?.desc || ''}*`).join('\n')
        : '*Inventaire vide. Achète des items via `/aventure boutique` !*';
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#F1C40F')
          .setTitle('🎒 Ton Inventaire')
          .setDescription(`💰 **${char.gold.toLocaleString('fr-FR')} or**\n\n${lines}`)],
      });
    }

    // ── /aventure soigner
    if (sub === 'soigner') {
      let inv; try { inv = JSON.parse(char.inventory); } catch { inv = []; }
      const idx = inv.findIndex(i => i === 'potion_legere' || i === 'potion_max');
      if (idx === -1) {
        return interaction.editReply({ content: '❌ Tu n\'as pas de potion. Achète-en via `/aventure boutique`.' });
      }
      const itemId = inv[idx];
      const heal = SHOP_ITEMS[itemId].effect.value;
      const newHp = Math.min(char.max_hp, char.hp + heal);
      inv.splice(idx, 1);
      updateChar(guildId, userId, { hp: newHp, inventory: JSON.stringify(inv) });
      return interaction.editReply({ content: `🧪 Tu as utilisé **${SHOP_ITEMS[itemId].name}** — PV : **${newHp}/${char.max_hp}**` });
    }

    // ── /aventure classement
    if (sub === 'classement') {
      const top = db.db.prepare('SELECT * FROM aventure_chars WHERE guild_id=? ORDER BY level DESC, xp DESC LIMIT 10').all(guildId);
      if (!top.length) return interaction.editReply({ content: '📊 Aucun aventurier pour l\'instant. Sois le premier avec `/aventure explorer` !' });
      const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
      const lines = top.map((c, i) => `${medals[i]} <@${c.user_id}> — **Lvl ${c.level}** · ${c.monsters_killed} kills · ${c.bosses_killed} boss · ${c.gold.toLocaleString('fr-FR')} or`).join('\n');
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#FFD700')
          .setTitle('🏆 Top 10 Aventuriers')
          .setDescription(lines)],
      });
    }

    // ── /aventure explorer
    if (sub === 'explorer') {
      const zoneKey = interaction.options.getString('zone');
      const zone = ZONES[zoneKey];
      if (!zone) return interaction.editReply({ content: '❌ Zone invalide.' });
      if (char.level < zone.minLvl) {
        return interaction.editReply({ content: `🔒 Cette zone requiert le niveau **${zone.minLvl}**. Tu es niveau **${char.level}**.` });
      }
      // Cooldown : 30 secondes entre exploration pour anti-spam
      const now = Math.floor(Date.now() / 1000);
      if (now - (char.last_explored || 0) < 30) {
        const wait = 30 - (now - char.last_explored);
        return interaction.editReply({ content: `⏳ Tu es essoufflé ! Réessaie dans **${wait}s**.` });
      }
      updateChar(guildId, userId, { last_explored: now });

      const enc = rollEncounter(zoneKey);
      if (enc.type === 'ambiance') {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(zone.color)
            .setTitle(`${zone.name} — Exploration`)
            .setDescription(`*${enc.text}*\n\nRéutilise \`/aventure explorer\` pour continuer.`)],
        });
      }
      if (enc.type === 'treasure') {
        const newGold = char.gold + enc.gold;
        updateChar(guildId, userId, { gold: newGold });
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#FFD700')
            .setTitle(`💰 Trésor découvert !`)
            .setDescription(`En explorant **${zone.name}**, tu trouves un coffre !\n\n+**${enc.gold} or**\nTotal : **${newGold.toLocaleString('fr-FR')} or**`)],
        });
      }
      // Combat
      const isBoss = enc.type === 'boss';
      const m = enc.monster;
      battles.set(userId, { monster: m, isBoss, zoneKey });
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(isBoss ? '#8B0000' : zone.color)
          .setTitle(`${isBoss ? '👑 BOSS RENCONTRÉ !' : '⚔️ Combat !'}  ${m.emoji} ${m.name}`)
          .setDescription([
            `**${m.name}** te barre la route dans **${zone.name}** !`,
            '',
            `❤️ PV ennemi : **${m.currentHp}/${m.hp}**`,
            `⚔️ ATK ennemi : **${m.atk}**`,
            '',
            `❤️ Tes PV : **${char.hp}/${char.max_hp}**`,
            `⚔️ Ton ATK : **${char.attack}**`,
            '',
            `*Choisis ton action :*`,
          ].join('\n'))],
        components: [combatButtons(userId, 0)],
      });
    }
  },

  async handleComponent(interaction, customId) {
    if (!customId.startsWith('av_')) return false;
    const parts = customId.split('_');
    const action = parts[1];
    const userId = parts[2];

    if (interaction.user.id !== userId) {
      if (!interaction.deferred && !interaction.replied) {
        return interaction.reply({ content: '❌ Ce n\'est pas ton aventure.', ephemeral: true }).catch(() => {});
      }
      return true;
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => {});
    }
    const guildId = interaction.guildId;
    let char = getChar(guildId, userId);
    if (!char) char = createChar(guildId, userId);

    // ── Achat boutique
    if (action === 'buy') {
      const itemId = parts.slice(3).join('_');
      const item = SHOP_ITEMS[itemId];
      if (!item) return interaction.followUp({ content: '❌ Item invalide.', ephemeral: true }).catch(() => true);
      if (char.gold < item.cost) {
        return interaction.followUp({ content: `❌ Pas assez d'or. Tu as ${char.gold}, il en faut ${item.cost}.`, ephemeral: true }).catch(() => true);
      }
      let inv; try { inv = JSON.parse(char.inventory); } catch { inv = []; }
      const newGold = char.gold - item.cost;
      const updates = { gold: newGold };
      // Effets directs (ATK, DEF, MAXHP, XP) sont permanents et appliqués immédiatement
      if (item.effect.type === 'atk')   updates.attack  = char.attack  + item.effect.value;
      if (item.effect.type === 'def')   updates.defense = char.defense + item.effect.value;
      if (item.effect.type === 'maxhp') { updates.max_hp = char.max_hp + item.effect.value; updates.hp = char.hp + item.effect.value; }
      if (item.effect.type === 'xp')    {
        char.xp += item.effect.value;
        const ups = checkLevelUp(char);
        updates.xp = char.xp;
        updates.level = char.level;
        updates.max_hp = char.max_hp;
        updates.attack = char.attack;
        updates.defense = char.defense;
        updates.hp = char.hp;
      }
      // Potions : ajout en inventaire pour usage différé
      if (item.effect.type === 'heal') {
        inv.push(itemId);
        updates.inventory = JSON.stringify(inv);
      }
      updateChar(guildId, userId, updates);
      return interaction.followUp({ content: `✅ Acheté **${item.name}** ! ${item.effect.type === 'heal' ? 'Ajouté à ton inventaire.' : 'Effet appliqué.'} (Reste : ${newGold} or)`, ephemeral: true }).catch(() => true);
    }

    // ── Combat actions
    const battle = battles.get(userId);
    if (!battle) {
      return interaction.followUp({ content: '⚠️ Aucun combat en cours. Utilise `/aventure explorer`.', ephemeral: true }).catch(() => true);
    }
    const m = battle.monster;
    const zone = ZONES[battle.zoneKey];

    // ── Fuir
    if (action === 'flee') {
      battles.delete(userId);
      // Pénalité : -10% PV
      const lostHp = Math.floor(char.max_hp * 0.1);
      const newHp = Math.max(1, char.hp - lostHp);
      updateChar(guildId, userId, { hp: newHp });
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#7F8C8D')
          .setTitle('🏃 Tu as fui le combat')
          .setDescription(`Tu t'es enfui face à **${m.name}**.\n\n💔 Tu perds **${lostHp} PV** dans la fuite.\n❤️ PV : **${newHp}/${char.max_hp}**`)],
        components: [],
      }).catch(() => true);
    }

    // ── Potion en combat
    if (action === 'potion') {
      let inv; try { inv = JSON.parse(char.inventory); } catch { inv = []; }
      const idx = inv.findIndex(i => i === 'potion_legere' || i === 'potion_max');
      if (idx === -1) {
        return interaction.followUp({ content: '❌ Pas de potion en inventaire. Achète-en via `/aventure boutique`.', ephemeral: true }).catch(() => true);
      }
      const itemId = inv[idx];
      const heal = SHOP_ITEMS[itemId].effect.value;
      const newHp = Math.min(char.max_hp, char.hp + heal);
      inv.splice(idx, 1);
      updateChar(guildId, userId, { hp: newHp, inventory: JSON.stringify(inv) });
      char.hp = newHp;
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setTitle(`🧪 Tu utilises ${SHOP_ITEMS[itemId].name}`)
          .setDescription(`+**${Math.min(heal, char.max_hp)} PV**\n❤️ PV : **${newHp}/${char.max_hp}**\n\n*Le combat continue — réattaque !*\n\n**${m.name}** (${m.currentHp}/${m.hp} PV)`)],
        components: [combatButtons(userId, 0)],
      }).catch(() => true);
    }

    // ── Attaquer (action principale)
    if (action === 'attack') {
      // Dégâts joueur sur monstre
      const playerDmg = Math.max(1, char.attack + Math.floor(Math.random() * 8) - 3);
      m.currentHp -= playerDmg;

      // Si monstre mort
      if (m.currentHp <= 0) {
        battles.delete(userId);
        char.xp += m.xp;
        char.gold += m.gold;
        const ups = checkLevelUp(char);
        const updates = {
          xp: char.xp, level: char.level, max_hp: char.max_hp,
          attack: char.attack, defense: char.defense, hp: char.hp,
          gold: char.gold,
          monsters_killed: char.monsters_killed + (battle.isBoss ? 0 : 1),
          bosses_killed:   char.bosses_killed   + (battle.isBoss ? 1 : 0),
        };
        updateChar(guildId, userId, updates);

        const upText = ups > 0 ? `\n⭐ **LEVEL UP ! Niveau ${char.level}** (+15 PV max, +3 ATK, +2 DEF, soin complet)` : '';
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#FFD700')
            .setTitle(`${battle.isBoss ? '👑 BOSS VAINCU !' : '☠️ Victoire !'}  ${m.emoji} ${m.name}`)
            .setDescription([
              `Tu as vaincu **${m.name}** !`,
              '',
              `+**${m.xp} XP**\n+**${m.gold} or**${upText}`,
              '',
              `❤️ PV : ${char.hp}/${char.max_hp}\n💰 Or : ${char.gold.toLocaleString('fr-FR')}`,
            ].join('\n'))],
          components: [],
        }).catch(() => true);
      }

      // Sinon le monstre contre-attaque
      const monsterDmg = Math.max(1, m.atk - char.defense + Math.floor(Math.random() * 6) - 3);
      const newHp = char.hp - monsterDmg;

      if (newHp <= 0) {
        // Mort du joueur
        battles.delete(userId);
        const goldLost = Math.floor(char.gold * 0.2);
        const newGold = char.gold - goldLost;
        updateChar(guildId, userId, {
          hp: Math.floor(char.max_hp * 0.5), // respawn à 50% PV
          gold: newGold,
          deaths: char.deaths + 1,
        });
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#000000')
            .setTitle('💀 TU ES MORT')
            .setDescription([
              `**${m.name}** t'a vaincu...`,
              '',
              `💰 -${goldLost} or perdu`,
              `❤️ Tu respawn à 50% PV (${Math.floor(char.max_hp * 0.5)}/${char.max_hp})`,
              '',
              `*Réessaie quand tu seras prêt.*`,
            ].join('\n'))],
          components: [],
        }).catch(() => true);
      }

      // Combat continue
      updateChar(guildId, userId, { hp: newHp });
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(zone?.color || '#E67E22')
          .setTitle(`${battle.isBoss ? '👑 ' : '⚔️ '} ${m.emoji} ${m.name}`)
          .setDescription([
            `Tu attaques pour **${playerDmg}** dégâts !`,
            `**${m.name}** riposte pour **${monsterDmg}** dégâts.`,
            '',
            `❤️ PV ennemi : **${m.currentHp}/${m.hp}**`,
            `❤️ Tes PV : **${newHp}/${char.max_hp}**`,
          ].join('\n'))],
        components: [combatButtons(userId, 0)],
      }).catch(() => true);
    }

    return true;
  },
};
