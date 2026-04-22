// collectibles.js — src/commands_guild/unique/collectibles.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { checkCooldown, cooldownMessage } = require('../../utils/cooldownManager');
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS collectibles (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, guild_id TEXT, card_id TEXT, obtained_at TEXT DEFAULT (strftime('%s','now')), UNIQUE(user_id,guild_id,card_id))`).run();
} catch {}
const CARDS = {
  c_sol:    {id:'c_sol',    name:'☀️ Soleil',        rarity:'Commun',     color:'#2ECC71',weight:30},
  c_lune:   {id:'c_lune',   name:'🌙 Lune',           rarity:'Commun',     color:'#2ECC71',weight:30},
  c_etoile: {id:'c_etoile', name:'⭐ Étoile',          rarity:'Commun',     color:'#2ECC71',weight:30},
  c_fleur:  {id:'c_fleur',  name:'🌸 Fleur',           rarity:'Commun',     color:'#2ECC71',weight:30},
  r_cristal:{id:'r_cristal',name:'💎 Cristal',         rarity:'Rare',       color:'#3498DB',weight:12},
  r_dragon: {id:'r_dragon', name:'🐉 Dragon',          rarity:'Rare',       color:'#3498DB',weight:12},
  r_phoenix:{id:'r_phoenix',name:'🦅 Phénix',          rarity:'Rare',       color:'#3498DB',weight:12},
  e_galaxy: {id:'e_galaxy', name:'🌌 Galaxie',         rarity:'Épique',     color:'#9B59B6',weight:5},
  e_demon:  {id:'e_demon',  name:'😈 Démon Ancien',    rarity:'Épique',     color:'#9B59B6',weight:5},
  e_ange:   {id:'e_ange',   name:'😇 Ange Gardien',    rarity:'Épique',     color:'#9B59B6',weight:5},
  l_nexus:  {id:'l_nexus',  name:'🏆 Carte NexusBot',  rarity:'Légendaire', color:'#FFD700',weight:1},
  l_roi:    {id:'l_roi',    name:'👑 Roi Éternel',      rarity:'Légendaire', color:'#FFD700',weight:1},
  l_chaos:  {id:'l_chaos',  name:'💥 Seigneur du Chaos',rarity:'Légendaire',color:'#E74C3C',weight:1},
};
const LIST=Object.values(CARDS);
function pickCard(){const tot=LIST.reduce((s,c)=>s+c.weight,0);let r=Math.random()*tot;for(const c of LIST){r-=c.weight;if(r<=0)return c;}return LIST[0];}
function getUserCards(uid,gid){return db.db.prepare('SELECT card_id FROM collectibles WHERE user_id=? AND guild_id=?').all(uid,gid).map(r=>r.card_id);}
module.exports={
  data:new SlashCommandBuilder().setName('collectibles').setDescription('🃏 Cartes à collectionner')
    .addSubcommand(s=>s.setName('ouvrir').setDescription('🎴 Obtenir une carte (cooldown 4h)'))
    .addSubcommand(s=>s.setName('collection').setDescription('📚 Voir votre collection').addUserOption(o=>o.setName('membre').setDescription('Autre membre')))
    .addSubcommand(s=>s.setName('infos').setDescription('🔍 Infos sur une carte').addStringOption(o=>o.setName('carte').setDescription('ID carte').setRequired(true)))
    .addSubcommand(s=>s.setName('echanger').setDescription('🤝 Offrir une carte').addUserOption(o=>o.setName('membre').setDescription('Destinataire').setRequired(true)).addStringOption(o=>o.setName('carte').setDescription('ID carte').setRequired(true))),
  async execute(interaction){
    const sub=interaction.options.getSubcommand(); const {guildId}=interaction; const userId=interaction.user.id;
    if(sub==='ouvrir'){
      const cd=checkCooldown(userId,'collectibles_ouvrir',4*3600);
      if(cd.onCooldown)return interaction.editReply({content:cooldownMessage(cd.remaining),ephemeral:true});
      const card=pickCard(); const owned=getUserCards(userId,guildId); const isNew=!owned.includes(card.id);
      try{db.db.prepare('INSERT OR IGNORE INTO collectibles(user_id,guild_id,card_id) VALUES(?,?,?)').run(userId,guildId,card.id);}catch{}
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(card.color).setTitle('🎴 Carte obtenue !').setDescription(`**${card.name}**\nRareté: **${card.rarity}**\n\n${isNew?'✨ **NOUVELLE carte !**':'🔄 Déjà possédée.'}`).addFields({name:'🆔 ID',value:`\`${card.id}\``,inline:true},{name:'📦 Collection',value:`${owned.length+(isNew?1:0)}/${LIST.length}`,inline:true}).setFooter({text:'Prochain tirage dans 4h'})]});
    }
    if(sub==='collection'){
      const t=interaction.options.getUser('membre')||interaction.user;
      const cards=getUserCards(t.id,guildId);
      if(!cards.length)return interaction.editReply({content:`❌ ${t.id===userId?'Vous n\'avez':t.username+' n\'a'} aucune carte.`,ephemeral:true});
      const byR={'Légendaire':[],'Épique':[],'Rare':[],'Commun':[]};
      for(const cid of cards){const c=CARDS[cid];if(c)byR[c.rarity]?.push(c.name);}
      const fields=Object.entries(byR).filter(([,l])=>l.length>0).map(([r,l])=>({name:`${r} (${l.length})`,value:l.join('\n').slice(0,1024)}));
      return interaction.editReply({embeds:[new EmbedBuilder().setColor('#9B59B6').setTitle(`🃏 Collection de ${t.username}`).setThumbnail(t.displayAvatarURL()).addFields(fields).setFooter({text:`${cards.length}/${LIST.length} cartes`})],ephemeral:true});
    }
    if(sub==='infos'){
      const cid=interaction.options.getString('carte').toLowerCase(); const card=CARDS[cid];
      if(!card)return interaction.editReply({content:`❌ Carte \`${cid}\` introuvable. IDs: ${LIST.map(c=>c.id).join(', ')}`,ephemeral:true});
      const h=db.db.prepare('SELECT COUNT(*) as cnt FROM collectibles WHERE guild_id=? AND card_id=?').get(guildId,cid).cnt;
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(card.color).setTitle(card.name).addFields({name:'🎖️ Rareté',value:`**${card.rarity}**`,inline:true},{name:'🆔 ID',value:`\`${card.id}\``,inline:true},{name:'👥 Détenteurs',value:`**${h}**`,inline:true})]});
    }
    if(sub==='echanger'){
      const target=interaction.options.getUser('membre'); const cid=interaction.options.getString('carte').toLowerCase();
      if(target.id===userId)return interaction.editReply({content:'❌ Impossible.',ephemeral:true});
      const card=CARDS[cid]; if(!card)return interaction.editReply({content:`❌ Carte introuvable.`,ephemeral:true});
      const owned=getUserCards(userId,guildId); if(!owned.includes(cid))return interaction.editReply({content:`❌ Vous ne possédez pas \`${cid}\`.`,ephemeral:true});
      db.db.prepare('DELETE FROM collectibles WHERE user_id=? AND guild_id=? AND card_id=?').run(userId,guildId,cid);
      db.db.prepare('INSERT OR IGNORE INTO collectibles(user_id,guild_id,card_id) VALUES(?,?,?)').run(target.id,guildId,cid);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor('#2ECC71').setTitle('🤝 Échange !').setDescription(`**${card.name}** (${card.rarity}) offert à ${target}.`)]});
    }
  }
};
