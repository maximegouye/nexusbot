const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');

// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
function mkFake(message, opts = {}) {
  let replied = false, deferred = false;
  const send = async (data) => {
    if (replied || deferred) return message.channel.send(data).catch(() => {});
    replied = true;
    return message.reply(data).catch(() => message.channel.send(data).catch(() => {}));
  };
  return {
    user: message.author, member: message.member,
    guild: message.guild, guildId: message.guildId,
    channel: message.channel, client: message.client,
    get deferred() { return deferred; }, get replied() { return replied; },
    options: {
      getSubcommand: opts.getSubcommand || (() => null),
      getUser:    opts.getUser    || ((k) => null),
      getMember:  opts.getMember  || ((k) => null),
      getRole:    opts.getRole    || ((k) => null),
      getChannel: opts.getChannel || ((k) => null),
      getString:  opts.getString  || ((k) => null),
      getInteger: opts.getInteger || ((k) => null),
      getNumber:  opts.getNumber  || ((k) => null),
      getBoolean: opts.getBoolean || ((k) => null),
    },
    deferReply: async () => { deferred = true; },
    editReply:  async (d) => send(d),
    reply:      async (d) => send(d),
    followUp:   async (d) => message.channel.send(d).catch(() => {}),
    update:     async (d) => {},
  };
}


function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}
function rgbToHsl(r,g,b) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){ h=s=0; } else {
    const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){ case r: h=(g-b)/d+(g<b?6:0); break; case g: h=(b-r)/d+2; break; case b: h=(r-g)/d+4; break; }
    h/=6;
  }
  return { h:Math.round(h*360), s:Math.round(s*100), l:Math.round(l*100) };
}
function getColorName(r,g,b) {
  const colors = [
    {name:'Rouge',r:255,g:0,b:0},{name:'Vert',r:0,g:128,b:0},{name:'Bleu',r:0,g:0,b:255},
    {name:'Jaune',r:255,g:255,b:0},{name:'Orange',r:255,g:165,b:0},{name:'Violet',r:128,g:0,b:128},
    {name:'Rose',r:255,g:192,b:203},{name:'Blanc',r:255,g:255,b:255},{name:'Noir',r:0,g:0,b:0},
    {name:'Gris',r:128,g:128,b:128},{name:'Cyan',r:0,g:255,b:255},{name:'Magenta',r:255,g:0,b:255},
    {name:'Marron',r:165,g:42,b:42},{name:'Or',r:255,g:215,b:0},{name:'Argent',r:192,g:192,b:192},
  ];
  let closest=colors[0], minDist=Infinity;
  for(const c of colors) {
    const d=Math.sqrt((r-c.r)**2+(g-c.g)**2+(b-c.b)**2);
    if(d<minDist){minDist=d;closest=c;}
  }
  return closest.name;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('color')
    .setDescription('🎨 Visualiser une couleur hexadécimale')
    .addStringOption(o => o.setName('hex').setDescription('Code hex (ex: #7B2FBE ou 7B2FBE)').setRequired(true)),

  async execute(interaction) {
    let hex = interaction.options.getString('hex').trim().replace(/^#/, '');
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Format invalide. Exemple: `#7B2FBE` ou `FF5500`', ephemeral: true });
    }
    hex = hex.toUpperCase();
    const { r, g, b } = hexToRgb('#' + hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    const name = getColorName(r, g, b);

    // Créer une image de couleur simple avec canvas si dispo
    let attachment = null;
    try {
      const { createCanvas } = require('canvas');
      const canvas = createCanvas(200, 100);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#' + hex;
      ctx.fillRect(0, 0, 200, 100);
      // Texte contrasté
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      ctx.fillStyle = brightness > 128 ? '#000000' : '#FFFFFF';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`#${hex}`, 100, 57);
      attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'color.png' });
    } catch {}

    const embed = new EmbedBuilder()
      .setColor('#' + hex)
      .setTitle(`🎨 Couleur #${hex}`)
      .addFields(
        { name: '🔢 HEX', value: `\`#${hex}\``, inline: true },
        { name: '🔢 RGB', value: `\`rgb(${r}, ${g}, ${b})\``, inline: true },
        { name: '🔢 HSL', value: `\`hsl(${h}°, ${s}%, ${l}%)\``, inline: true },
        { name: '🏷️ Nom approx.', value: name, inline: true },
        { name: '💡 Luminosité', value: `${Math.round((r * 299 + g * 587 + b * 114) / 10) / 100}%`, inline: true },
      );

    if (attachment) {
      embed.setThumbnail('attachment://color.png');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], files: [attachment] });
    }
    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  },
  name: 'color',
  aliases: ["couleur2", "hex2"],
    async run(message, args) {
    const hex = args[0] || '#7B2FBE';
    const fake = mkFake(message, { getString: () => hex });
    await this.execute(fake);
  },
};
