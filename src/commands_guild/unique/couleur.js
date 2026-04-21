const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
    .addSubcommand(s => s.setName('aleatoire').setDescription('🎲 Générer une couleur aléatoire'))
    .addSubcommand(s => s.setName('palette').setDescription('🎨 Générer une palette harmonieuse')
      .addStringOption(o => o.setName('hex').setDescription('Couleur de base (HEX)').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    async function sendColor(hex) {
      hex = hex.replace('#','');
      if(!/^[0-9A-Fa-f]{6}$/.test(hex)) return interaction.reply({ content: '❌ Code HEX invalide. Format : `#7B2FBE`', ephemeral: true });
      hex = hex.toUpperCase();
      const {r,g,b} = hexToRgb('#'+hex);
      const {h,s,l} = rgbToHsl(r,g,b);
      const name = getColorName(r,g,b);
      const imgUrl = `https://singlecolorimage.com/get/${hex}/100x100`;

      return interaction.reply({ embeds: [
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
      const r = parseInt(interaction.options.getString('rouge'));
      const g = parseInt(interaction.options.getString('vert'));
      const b = parseInt(interaction.options.getString('bleu'));
      return sendColor(rgbToHex(r,g,b));
    }

    if (sub === 'aleatoire') {
      return sendColor(randomHex());
    }

    if (sub === 'palette') {
      let hex = interaction.options.getString('hex').replace('#','');
      if(!/^[0-9A-Fa-f]{6}$/.test(hex)) return interaction.reply({ content: '❌ HEX invalide.', ephemeral: true });
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

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(`#${hex}`)
          .setTitle('🎨 Palette harmonieuse')
          .setDescription(lines)
          .setFooter({ text: 'Couleurs générées selon la théorie des couleurs' })
      ]});
    }
  }
};
