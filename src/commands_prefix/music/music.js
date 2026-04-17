/**
 * NexusBot — Musique et culture musicale (prefix)
 * n!note, n!gamme, n!tempo, n!genre_musique, n!histoire_musique, n!accord, n!instrument...
 */
const { EmbedBuilder } = require('discord.js');

const NOTES = {
  do:  { freq:'261.63 Hz', midi:60, anglais:'C', desc:'Do central (C4)' },
  re:  { freq:'293.66 Hz', midi:62, anglais:'D', desc:'Ré (D4)' },
  mi:  { freq:'329.63 Hz', midi:64, anglais:'E', desc:'Mi (E4)' },
  fa:  { freq:'349.23 Hz', midi:65, anglais:'F', desc:'Fa (F4)' },
  sol: { freq:'392.00 Hz', midi:67, anglais:'G', desc:'Sol (G4)' },
  la:  { freq:'440.00 Hz', midi:69, anglais:'A', desc:'La de référence (A4) — diapason' },
  si:  { freq:'493.88 Hz', midi:71, anglais:'B', desc:'Si (B4)' },
};

const GENRES = [
  { name:'Jazz', origine:'États-Unis, fin XIXe', desc:'Improvisation, swing, blues. Miles Davis, John Coltrane, Duke Ellington.' },
  { name:'Rock', origine:'États-Unis, années 1950', desc:'Guitare électrique dominante. Chuck Berry, Elvis, The Beatles, Led Zeppelin.' },
  { name:'Hip-Hop', origine:'New York, années 1970', desc:'Rap, DJing, breakdance, graffiti. Grandmaster Flash, Public Enemy, Tupac, Jay-Z.' },
  { name:'Classique', origine:'Europe, XVIIe-XIXe s.', desc:'Orchestre symphonique. Bach, Mozart, Beethoven, Chopin, Debussy.' },
  { name:'Électronique', origine:'Europe/USA, années 1970-80', desc:'Synthétiseurs, samples, beats. Kraftwerk, Daft Punk, Deadmau5.' },
  { name:'Reggae', origine:'Jamaïque, années 1960', desc:'Rythme off-beat, culture Rastafari. Bob Marley, Peter Tosh, Burning Spear.' },
  { name:'Afrobeats', origine:'Afrique de l\'Ouest, 2000s', desc:'Fusionne highlife, jazz, hip-hop. Burna Boy, Wizkid, Davido.' },
  { name:'K-Pop', origine:'Corée du Sud, années 1990', desc:'Pop chorégraphiée, visuel soigné. BTS, BLACKPINK, EXO.' },
  { name:'Blues', origine:'Sud des États-Unis, XIXe', desc:'Structure 12 mesures, âme profonde. BB King, Robert Johnson, Muddy Waters.' },
  { name:'Soul/R&B', origine:'États-Unis, années 1950', desc:'Voix puissantes, groove. James Brown, Aretha Franklin, Stevie Wonder.' },
];

const INSTRUMENTS = [
  { name:'Guitare', famille:'Cordes pincées', cordes:6, notes:'E-A-D-G-B-E', fait:'Plus de 800 millions de guitares vendues dans le monde.' },
  { name:'Piano', famille:'Cordes frappées/percussions', touches:88, fait:'Le piano a 88 touches couvrant 7+ octaves. Plus de 10 000 pièces mobiles.' },
  { name:'Violon', famille:'Cordes frottées', cordes:4, notes:'G-D-A-E', fait:'Un violon de qualité peut valoir des millions d\'euros (Stradivarius).' },
  { name:'Trompette', famille:'Cuivres', fait:'Produit des sons par vibration des lèvres du musicien dans l\'embouchure.' },
  { name:'Flûte traversière', famille:'Bois', fait:'L\'un des plus anciens instruments : des flûtes vieilles de 43 000 ans ont été trouvées.' },
  { name:'Batterie', famille:'Percussions', fait:'Un set complet peut avoir 20+ éléments. Ringo Starr des Beatles a démocratisé la batterie rock.' },
  { name:'Saxophone', famille:'Bois (corps métal)', fait:'Inventé par Adolphe Sax en 1846. Très utilisé en jazz et musique classique.' },
  { name:'Djembé', famille:'Percussions', fait:'Origine Afrique de l\'Ouest (Mali, Guinée). Son grave, ton, slap — 3 sons fondamentaux.' },
  { name:'Kora', famille:'Cordes pincées', cordes:21, fait:'Instrument traditionnel du Mandé (Afrique de l\'Ouest). Sons proches de la harpe et du luth.' },
];

const GAMMES = {
  majeure:     ['Do','Ré','Mi','Fa','Sol','La','Si','Do'],
  mineure:     ['Do','Ré','Mib','Fa','Sol','Lab','Sib','Do'],
  pentatonique:['Do','Ré','Mi','Sol','La','Do'],
  blues:       ['Do','Mib','Fa','Fa#','Sol','Sib','Do'],
  chromatique: ['Do','Do#','Ré','Ré#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si','Do'],
};

const TEMPOS = [
  { name:'Larghissimo', bpm:'< 24', desc:'Très très lent' },
  { name:'Largo',       bpm:'24-40',desc:'Large et majestueux' },
  { name:'Adagio',      bpm:'44-66',desc:'Lent et expressif' },
  { name:'Andante',     bpm:'66-76',desc:'Pas de promenade' },
  { name:'Moderato',    bpm:'76-108',desc:'Modéré' },
  { name:'Allegro',     bpm:'120-156',desc:'Vif et rapide' },
  { name:'Vivace',      bpm:'156-176',desc:'Vif et animé' },
  { name:'Presto',      bpm:'168-200',desc:'Très rapide' },
  { name:'Prestissimo', bpm:'> 200', desc:'Aussi vite que possible' },
];

const commands = [
  {
    name: 'note_musique',
    aliases: ['note', 'note_freq', 'frequence'],
    description: 'Infos sur une note de musique',
    category: 'Musique',
    cooldown: 3,
    async execute(message, args) {
      const key = args[0]?.toLowerCase();
      const note = NOTES[key];
      if (!key || !note) return message.reply(`❌ Usage : \`n!note_musique <note>\` — Disponibles : ${Object.keys(NOTES).join(', ')}`);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle(`🎵 Note : ${key.toUpperCase()}`)
        .addFields(
          { name: '🔊 Fréquence', value: note.freq, inline: true },
          { name: '🎹 MIDI', value: note.midi.toString(), inline: true },
          { name: '🇬🇧 Notation anglaise', value: note.anglais, inline: true },
          { name: '📝 Info', value: note.desc, inline: false },
        )] });
    }
  },
  {
    name: 'genre_musique',
    aliases: ['genremusical', 'style_musique', 'genre_musical'],
    description: 'Informations sur un genre musical',
    category: 'Musique',
    cooldown: 3,
    async execute(message, args) {
      const g = GENRES[Math.floor(Math.random() * GENRES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`🎶 Genre : ${g.name}`)
        .addFields(
          { name: '📍 Origine', value: g.origine, inline: true },
          { name: '📖 Description', value: g.desc, inline: false },
        )] });
    }
  },
  {
    name: 'instrument',
    aliases: ['instr', 'instruments', 'instru'],
    description: 'Infos sur un instrument de musique',
    category: 'Musique',
    cooldown: 3,
    async execute(message, args) {
      const i = INSTRUMENTS[Math.floor(Math.random() * INSTRUMENTS.length)];
      const fields = [
        { name: '🎼 Famille', value: i.famille, inline: true },
        { name: '💡 Fait', value: i.fait, inline: false },
      ];
      if (i.cordes) fields.splice(1, 0, { name: '🎸 Cordes', value: i.cordes.toString(), inline: true });
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle(`🎸 ${i.name}`)
        .addFields(...fields)] });
    }
  },
  {
    name: 'gamme',
    aliases: ['scale', 'gamme_musicale'],
    description: 'Afficher une gamme musicale',
    category: 'Musique',
    cooldown: 3,
    async execute(message, args) {
      const key = args[0]?.toLowerCase();
      if (!key || !GAMMES[key]) {
        return message.reply(`❌ Usage : \`n!gamme <type>\` — Disponibles : ${Object.keys(GAMMES).join(', ')}`);
      }
      const notes = GAMMES[key];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle(`🎼 Gamme ${key} (en Do)`)
        .setDescription(`${notes.join(' — ')}`)
        .setFooter({ text: `${notes.length} notes` })] });
    }
  },
  {
    name: 'tempo',
    aliases: ['bpm', 'vitesse_musicale', 'tempos'],
    description: 'Guide des tempos musicaux',
    category: 'Musique',
    cooldown: 3,
    async execute(message, args) {
      const bpmVal = parseInt(args[0]);
      if (!isNaN(bpmVal)) {
        const t = TEMPOS.find(t => {
          const [min, max] = t.bpm.replace(/[<>]/g, '').split('-').map(v => parseInt(v) || (t.bpm.startsWith('<') ? 0 : 999));
          return bpmVal >= min && bpmVal <= max;
        });
        if (t) return message.reply(`🎵 **${bpmVal} BPM** correspond au tempo **${t.name}** — ${t.desc}`);
      }
      const desc = TEMPOS.map(t => `**${t.name}** (${t.bpm} BPM) — ${t.desc}`).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle('🎵 Guide des tempos')
        .setDescription(desc)
        .setFooter({ text: 'n!tempo <BPM> pour identifier un tempo' })] });
    }
  },
  {
    name: 'accord_guitare',
    aliases: ['accord', 'chord', 'guitare_accord'],
    description: 'Accords de guitare de base',
    category: 'Musique',
    cooldown: 3,
    async execute(message, args) {
      const ACCORDS = {
        'C':  { nom:'Do majeur',      notes:'Do-Mi-Sol',     doigte:'x32010' },
        'G':  { nom:'Sol majeur',     notes:'Sol-Si-Ré',     doigte:'320003' },
        'D':  { nom:'Ré majeur',      notes:'Ré-Fa#-La',     doigte:'xx0232' },
        'E':  { nom:'Mi majeur',      notes:'Mi-Sol#-Si',    doigte:'022100' },
        'A':  { nom:'La majeur',      notes:'La-Do#-Mi',     doigte:'x02220' },
        'Am': { nom:'La mineur',      notes:'La-Do-Mi',      doigte:'x02210' },
        'Em': { nom:'Mi mineur',      notes:'Mi-Sol-Si',     doigte:'022000' },
        'F':  { nom:'Fa majeur',      notes:'Fa-La-Do',      doigte:'133211 (barré)' },
      };
      const key = args[0]?.toUpperCase();
      const acc = ACCORDS[key];
      if (!key || !acc) return message.reply(`❌ Usage : \`n!accord_guitare <accord>\` — Ex: C, G, D, E, A, Am, Em, F`);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle(`🎸 Accord ${key} — ${acc.nom}`)
        .addFields(
          { name: '🎵 Notes', value: acc.notes, inline: true },
          { name: '👆 Doigté (tab)', value: `\`${acc.doigte}\``, inline: true },
        )] });
    }
  },
  {
    name: 'histoire_musique',
    aliases: ['histo_musique', 'musique_epoque'],
    description: 'Histoire de la musique par époque',
    category: 'Musique',
    cooldown: 5,
    async execute(message, args) {
      const EPOQUES = [
        { era:'Antiquité (avant 500)', desc:'Instruments à vent, cordes et percussion. Musique dans rituels religieux en Grèce, Égypte, Mésopotamie.' },
        { era:'Médiéval (500-1400)', desc:'Chant grégorien, polyphonie naissante. Guillaume de Machaut, Hildegard von Bingen.' },
        { era:'Renaissance (1400-1600)', desc:'Développement de la polyphonie vocale. Josquin des Prés, Palestrina, Monteverdi.' },
        { era:'Baroque (1600-1750)', desc:'Opéra, oratorio, concerto. Vivaldi, Bach, Haendel, Purcell.' },
        { era:'Classicisme (1750-1820)', desc:'Forme sonate, symphonie, quatuor. Haydn, Mozart, Beethoven (début).' },
        { era:'Romantisme (1820-1900)', desc:'Expression émotionnelle, programmes. Beethoven, Chopin, Liszt, Wagner, Brahms.' },
        { era:'Modernisme (1900-1945)', desc:'Atonalisme, jazz, impressionnisme. Debussy, Stravinsky, Schoenberg, Ravel.' },
        { era:'Contemporain (1945+)', desc:'Électronique, minimalisme, world music, hip-hop, pop mondiale.'},
      ];
      const e = EPOQUES[Math.floor(Math.random() * EPOQUES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#8E44AD')
        .setTitle(`🎼 Époque : ${e.era}`)
        .setDescription(e.desc)] });
    }
  },
  {
    name: 'record_musique',
    aliases: ['musique_record', 'records_musicaux'],
    description: 'Records musicaux mondials',
    category: 'Musique',
    cooldown: 5,
    async execute(message, args) {
      const RECORDS = [
        "🎵 **Album le plus vendu** : Thriller de Michael Jackson (~66 millions d'exemplaires)",
        "🎤 **Single le plus vendu** : Candle in the Wind (1997) - Elton John (37 millions)",
        "🎶 **Artiste solo le plus vendu** : Elvis Presley (600 millions d'albums)",
        "🎸 **Groupe le plus vendu** : The Beatles (~1 milliard d'albums vendus)",
        "▶️ **Chanson la plus streamée** : Shape of You - Ed Sheeran (15+ milliards sur Spotify)",
        "🎹 **Concerto joué le plus souvent** : Concerto pour piano n°21 de Mozart",
        "👥 **Plus grand concert** : Rod Stewart, Copacabana (1994) : 3,5 millions de spectateurs",
      ];
      const r = RECORDS[Math.floor(Math.random() * RECORDS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F39C12')
        .setTitle('🏆 Record musical')
        .setDescription(r)] });
    }
  },
  {
    name: 'solfege',
    aliases: ['theorie', 'cours_musique', 'theorie_musicale'],
    description: 'Mini cours de solfège',
    category: 'Musique',
    cooldown: 5,
    async execute(message, args) {
      const LECONS = [
        { titre:'Les clés (clefs)', contenu:'Clé de sol : pour voix aiguës et instruments à tessiture haute.\nClé de fa : pour voix graves et instruments graves (basse, violoncelle).\nClé d\'ut : pour violon alto, violoncelle, trombone.' },
        { titre:'Les durées', contenu:'Ronde = 4 temps\nBlanche = 2 temps\nNoire = 1 temps\nCroche = 1/2 temps\nDouble croche = 1/4 temps' },
        { titre:'Les nuances', contenu:'pp = pianissimo (très doux)\np = piano (doux)\np = piano (doux)\nmf = mezzo forte (modéré)\nf = forte (fort)\nff = fortissimo (très fort)' },
        { titre:'Les intervalles', contenu:'Unisson, Seconde, Tierce, Quarte, Quinte, Sixte, Septième, Octave\nChaque intervalle peut être majeur, mineur, juste, augmenté ou diminué.' },
      ];
      const l = LECONS[Math.floor(Math.random() * LECONS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle(`🎓 Solfège : ${l.titre}`)
        .setDescription(l.contenu)] });
    }
  },
  {
    name: 'playlist_humeur',
    aliases: ['playlist', 'musique_humeur', 'mood_playlist'],
    description: 'Suggestion de playlist selon votre humeur',
    category: 'Musique',
    cooldown: 5,
    async execute(message, args) {
      const HUMEURS = {
        triste:     { genres:['Blues','Soul','Ballades rock'], artistes:['Adele','Jeff Buckley','Nina Simone'], conseil:'La musique triste aide souvent à se libérer des émotions.' },
        heureux:    { genres:['Pop','Afrobeats','Funk'], artistes:['Pharrell Williams','Daft Punk','Burna Boy'], conseil:'Let the music make you dance !' },
        concentré:  { genres:['Classique','Lofi','Jazz instrumental'], artistes:['Debussy','Nils Frahm','Chet Baker'], conseil:'70-85 BPM favorise la concentration.' },
        energique:  { genres:['Hip-Hop','Rock','Électro'], artistes:['Eminem','ACDC','The Prodigy'], conseil:'Parfait pour le sport ou le travail intense.' },
        romantique: { genres:['Soul','Jazz','Bossa Nova'], artistes:['Frank Sinatra','Norah Jones','João Gilberto'], conseil:'La musique crée l\'ambiance.' },
      };
      const key = args[0]?.toLowerCase();
      const h = HUMEURS[key] || HUMEURS.heureux;
      const humeurNom = key && HUMEURS[key] ? key : 'heureux';
      return message.reply({ embeds: [new EmbedBuilder().setColor('#FF69B4')
        .setTitle(`🎧 Playlist pour humeur : ${humeurNom}`)
        .addFields(
          { name: '🎵 Genres', value: h.genres.join(', '), inline: true },
          { name: '🎤 Artistes', value: h.artistes.join(', '), inline: true },
          { name: '💡 Conseil', value: h.conseil, inline: false },
        )
        .setFooter({ text: `Humeurs disponibles : ${Object.keys(HUMEURS).join(', ')}` })] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
