// meteo_marche.js — src/commands_guild/economy/meteo_marche.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
try { db.db.prepare(`CREATE TABLE IF NOT EXISTS market_weather (guild_id TEXT PRIMARY KEY, event_key TEXT, event_date TEXT, multiplier REAL DEFAULT 1.0)`).run(); } catch {}
const EVENTS = [
  {key:'bull',   name:'📈 Marché Haussier',       color:'#2ECC71', description:'La bourse monte ! Gains boostés.',           multiplier:1.5, tip:'💡 Investissez et jouez maintenant !'},
  {key:'bear',   name:'📉 Marché Baissier',        color:'#E74C3C', description:'Récession ! Gains réduits.',                 multiplier:0.7, tip:'💡 Gardez votre argent à la banque.'},
  {key:'inflation',name:'💸 Inflation',            color:'#E67E22', description:'Les prix s\'envolent, mais salaires aussi.', multiplier:1.2, tip:'💡 Achetez avant que les prix montent.'},
  {key:'stable', name:'⚖️ Marché Stable',          color:'#3498DB', description:'Économie calme et stable.',                  multiplier:1.0, tip:'💡 Planifiez vos investissements.'},
  {key:'bonus',  name:'🎉 Fête Économique',        color:'#9B59B6', description:'Événement spécial ! Tout est boosté !',      multiplier:2.0, tip:'💡 Profitez au maximum !'},
  {key:'crash',  name:'💥 Krach Boursier',         color:'#C0392B', description:'Les marchés s\'effondrent.',                 multiplier:0.5, tip:'💡 Évitez les risques aujourd\'hui.'},
  {key:'gold',   name:'🥇 Ruée vers l\'Or',        color:'#FFD700', description:'Les ressources valent plus !',               multiplier:1.8, tip:'💡 Minez, chassez, craftez !'}
];
function getTodayEvent(guildId) {
  const today=new Date().toISOString().slice(0,10);
  let row=db.db.prepare('SELECT * FROM market_weather WHERE guild_id=?').get(guildId);
  if (row && row.event_date===today) return EVENTS.find(e=>e.key===row.event_key)||EVENTS[3];
  const w=[15,15,12,30,5,8,15]; const tot=w.reduce((s,v)=>s+v,0); let r=Math.random()*tot, idx=0;
  for(let i=0;i<w.length;i++){r-=w[i];if(r<=0){idx=i;break;}}
  const ev=EVENTS[idx];
  db.db.prepare('INSERT OR REPLACE INTO market_weather (guild_id,event_key,event_date,multiplier) VALUES (?,?,?,?)').run(guildId,ev.key,today,ev.multiplier);
  return ev;
}
function getMarketMultiplier(guildId) {
  const today=new Date().toISOString().slice(0,10);
  const row=db.db.prepare('SELECT multiplier,event_date FROM market_weather WHERE guild_id=?').get(guildId);
  return (row&&row.event_date===today)?row.multiplier:1.0;
}
module.exports = {
  data: new SlashCommandBuilder().setName('meteo_marche').setDescription('📊 Météo économique du jour'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const cfg=db.getConfig(interaction.guildId); const coin=cfg.currency_emoji||'€';
    const ev=getTodayEvent(interaction.guildId);
    const next=new Date(); next.setUTCHours(0,0,0,0); next.setUTCDate(next.getUTCDate()+1);
    const ms=next-new Date(); const h=Math.floor(ms/3600000); const m=Math.floor((ms%3600000)/60000);
    const embed=new EmbedBuilder().setColor(ev.color).setTitle(ev.name).setDescription(ev.description)
      .addFields(
        {name:`📊 Impact`,value:ev.multiplier>=1?`✅ **+${Math.round((ev.multiplier-1)*100)}%** gains`:`⚠️ **-${Math.round((1-ev.multiplier)*100)}%** gains`,inline:true},
        {name:'⏱️ Expire',value:`**${h}h ${m}m**`,inline:true},
        {name:'🎯 Multiplicateur',value:`**x${ev.multiplier.toFixed(1)}**`,inline:true}
      )
      .addFields({name:'📌 Conseil',value:ev.tip})
      .setFooter({text:'Météo économique change chaque jour à minuit UTC'}).setTimestamp();
    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({embeds:[embed]});
  },
  getMarketMultiplier
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
