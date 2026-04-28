const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
  return {r,g,b};
}
function rgbToHex(r,g,b) { return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase(); }
function rgbToHsl(r,g,b) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s, l=(max+min)/2;
  if(max===min){h=s=0;}
  else{const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min); switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;default:h=((r-g)/d+4)/6;}}
  return {h:Math.round(h*360),s:Math.round(s*100),l:Math.round(l*100)};
}
function getColorName(r,g,b) {
  const colors = {
    'Rouge':  [255,0,0], 'Vert':  [0,128,0], 'Bleu':   [0,0,255],
    'Jaune':  [255,255,0],'Cyan':  [0,255,255],'Magenta':[255,0,255],
    'Orange': [255,165,0],'Rose':  [255,192,203],'Violet':[128,0,128],
    'Blanc':  [255,255,255],'Noir': [0,0,0],'Gris':   [128,128,128],
    'Marron': [139,69,19],'Lime':  [0,255,0],'Indigo': [75,0,130],
    'Corail': [255,127,80],'Or':    [255,215,0],'Argent':[192,192,192],
  };
  let nearest='Inconnu', minDist=Infinity;
  for(const [name,[cr,cg,cb]] of Object.entries(colors)){
    const d=Math.sqrt((r-cr)**2+(g-cg)**2+(b-cb)**2);
    if(d<minDist){minDist=d;nearest=name;}
  }
  return nearest;
}
function randomHex(){return '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0').toUpperCase();}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('couleur')
    .setDescription('🎨 Explorateur de couleurs — Convertissez et affichez des couleurs')
    .addSubcommand(s => s.setName('hex').setDescription('🎨 Analyser une couleur HEX')
      .addStringOption(o => o.setName('valeur').setDescription('Code HEX (ex: #7B2FBE ou 7B2FBE)').setRequired(true)))
    .addSubcommand(s => s.setName('rgb').setDescription('🎨 Analyser une couleur RGB')
      .addIntegerOption(o => o.setName('rouge').setDescription('Composant rouge (0-255)').setRequired(true).setMinValue(0).setMaxValue(255))
      .addIntegerOption(o => o.setName('vert').setDescription('Composant vert (0-255)').setRequired(true).setMinValue(0).setMaxValue(255))
      .addIntegerOption(o => o.setName('bleu').setDescription('Composant bleu (0-255)').setRequired(true).setMinValue(0).setMaxValue(255)))
    .addSubcommand(s => s.setName('aleatoire').setDescription('🎲 Générer une couleur aléatoire'))
    .addSubcommand(s => s.setName('palette').setDescription('🎨 Générer une palette harmonieuse')
      .addStringOption(o => o.setName('hex').setDescription('Couleur de base (HEX)').setRequired(true))),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* déjà ack */ }
    }

    try {
    const sub = interaction.options.getSubcommand();

    async function sendColor(hex) {
      hex = hex.replace('#','');
      if(!/^[0-9A-Fa-f]{6}$/.test(hex)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Code HEX invalide. Format : `#7B2FBE`', ephemeral: true });
      hex = hex.toUpperCase();
      const {r,g,b} = hexToRgb('#'+hex);
      const {h,s,l} = rgbToHsl(r,g,b);
      const name = getColorName(r,g,b);
      const imgUrl = `https://singlecolorimage.com/get/${hex}/100x100`;

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor(`#${hex}`)
          .setTitle(`🎨 Couleur — ${name}`)
          .setThumbnail(imgUrl)
          .addFields(
            { name: '🔷 HEX',  value: `\`#${hex}\``,            inline: true },
            { name: '🔴 RGB',  value: `rgb(${r}, ${g}, ${b})`,  inline: true },
            { name: '🌈 HSL',  value: `hsl(${h}°, ${s}%, ${l}%)`, inline: true },
          )
      ]});
    }

    if (sub === 'hex') {
      return sendColor(interaction.options.getString('valeur'));
    }

    if (sub === 'rgb') {
      const r = interaction.options.getInteger('rouge');
      const g = interaction.options.getInteger('vert');
      const b = interaction.options.getInteger('bleu');
      return sendColor(rgbToHex(r,g,b));
    }

    if (sub === 'aleatoire') {
      return sendColor(randomHex());
    }

    if (sub === 'palette') {
      let hex = interaction.options.getString('hex').replace('#','');
      if(!/^[0-9A-Fa-f]{6}$/.test(hex)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ HEX invalide.', ephemeral: true });
      const {r,g,b} = hexToRgb('#'+hex);
      const {h,s,l} = rgbToHsl(r,g,b);

      // Générer 5 couleurs harmonieuses (analogues + complémentaire)
      const angles = [0, 30, 60, 180, 210, 240];
      const palette = angles.map(a => {
        const newH = (h + a) % 360;
        // Simplification: juste teinter le hex
        const hsl2rgb = (h,s,l) => {
          s/=100;l/=100;
          const a=s*Math.min(l,1-l);
          const f=n=>{const k=(n+h/30)%12;return l-a*Math.max(Math.min(k-3,9-k,1),-1);};
          return {r:Math.round(f(0)*255),g:Math.round(f(8)*255),b:Math.round(f(4)*255)};
        };
        const {r:nr,g:ng,b:nb} = hsl2rgb(newH,s,l);
        return rgbToHex(Math.max(0,Math.min(255,nr)),Math.max(0,Math.min(255,ng)),Math.max(0,Math.min(255,nb)));
      });

      const lines = palette.map((c,i) => {
        const labels = ['Base','Analogue +30','Analogue +60','Complémentaire','Comp. -30','Comp. +60'];
        return `${labels[i]} : \`${c}\``;
      }).join('\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor(`#${hex}`)
          .setTitle('🎨 Palette harmonieuse')
          .setDescription(lines)
          .setFooter({ text: 'Couleurs générées selon la théorie des couleurs' })
      ]});
    }
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.editReply(errMsg).catch(() => {});
      }
    } catch {}
  }},
  name: 'couleur2',
  aliases: ["coulhex"],
    async run(message, args) {
    const hex = args[0];
    if (!hex) return message.reply('❌ Usage : `&couleur2 <#HEX>` ou `&couleur2 R G B`');
    const fake = mkFake(message, {
      getSubcommand: () => args.length >= 3 ? 'rgb' : 'hex',
      getString: (k) => k === 'valeur' ? hex : null,
      getInteger: (k) => k === 'rouge' ? parseInt(args[0]) : k === 'vert' ? parseInt(args[1]) : parseInt(args[2]),
    });
    await this.execute(fake);
  },
};
