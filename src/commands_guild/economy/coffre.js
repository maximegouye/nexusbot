// coffre.js — src/commands_guild/economy/coffre.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { checkCooldown, cooldownMessage } = require('../../utils/cooldownManager');
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS coffre_streaks (user_id TEXT, guild_id TEXT, streak INTEGER DEFAULT 1, last_open TEXT, total_opens INTEGER DEFAULT 1, PRIMARY KEY (user_id,guild_id))`).run();
} catch {}
const TIERS = [
  {name:'Bronze',  emoji:'🟤', color:'#CD7F32', weight:50, coins:{min:50,  max:300 }, xp:{min:10, max:50  }},
  {name:'Argent',  emoji:'⚪', color:'#C0C0C0', weight:30, coins:{min:300, max:1000}, xp:{min:50, max:150 }},
  {name:'Or',      emoji:'🟡', color:'#FFD700', weight:15, coins:{min:1000,max:3000}, xp:{min:150,max:400 }, bonus:'🎁 Bonus Salaire x2 pendant 1h !'},
  {name:'Diamant', emoji:'💎', color:'#B9F2FF', weight:5,  coins:{min:3000,max:8000}, xp:{min:400,max:1000}, bonus:'✨ Bonus XP x3 pendant 2h !'}
];
function pickTier() { const tot=TIERS.reduce((s,t)=>s+t.weight,0); let r=Math.random()*tot; for(const t of TIERS){r-=t.weight;if(r<=0)return t;} return TIERS[0]; }
function rand(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
module.exports = {
  data: new SlashCommandBuilder().setName('coffre').setDescription('🎁 Ouvrir votre coffre quotidien !'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const {guildId} = interaction; const userId = interaction.user.id;
    const cfg = db.getConfig(guildId); const coin = cfg.currency_emoji||'€';
    const cd = checkCooldown(userId,'coffre',22*3600);
    if (cd.onCooldown) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({content:cooldownMessage(cd.remaining),ephemeral:true});
    const today = new Date().toISOString().slice(0,10);
    let row = db.db.prepare('SELECT * FROM coffre_streaks WHERE user_id=? AND guild_id=?').get(userId,guildId);
    let streak=1;
    if (row) {
      const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
      streak = row.last_open===yesterday ? row.streak+1 : 1;
      db.db.prepare('UPDATE coffre_streaks SET streak=?,last_open=?,total_opens=total_opens+1 WHERE user_id=? AND guild_id=?').run(streak,today,userId,guildId);
    } else { db.db.prepare('INSERT INTO coffre_streaks (user_id,guild_id,streak,last_open) VALUES (?,?,1,?)').run(userId,guildId,today); }
    const tier=pickTier();
    const mult=Math.min(1+(streak-1)*0.1, 2.0);
    const coins=Math.floor(rand(tier.coins.min,tier.coins.max)*mult);
    const xp=Math.floor(rand(tier.xp.min,tier.xp.max)*mult);
    db.addCoins(userId,guildId,coins); db.addXP(userId,guildId,xp);
    const embed = new EmbedBuilder()
      .setColor(tier.color)
      .setTitle(`${tier.emoji} Coffre ${tier.name} ouvert !`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setDescription(streak>=2?`🔥 **Streak x${streak}** — bonus **+${Math.round((mult-1)*100)}%** !`:'🆕 Premier coffre du jour !')
      .addFields(
        {name:`${coin} Pièces`,value:`**+${coins.toLocaleString('fr-FR')} ${coin}**`,inline:true},
        {name:'⭐ XP',value:`**+${xp} XP**`,inline:true},
        {name:'📅 Streak',value:`**${streak} jour${streak>1?'s':''}**`,inline:true}
      )
      .setFooter({text:'Prochain coffre dans ~22h'});
    if (tier.bonus) embed.addFields({name:'🎉 Bonus !',value:tier.bonus});
    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({embeds:[embed]});
  }
};
