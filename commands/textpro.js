export const name = 'textpro';
export const aliases = [
  'candy', 'christmas', '3dchristmas', 'sparklechristmas', 'deepsea', 'scifi', 
  'rainbow', 'waterpipe', 'spooky', 'pencil', 'circuit', 'discovery', 'metalic', 
  'fiction', 'demon', 'transformer', 'berry', 'thunder', 'magma', '3dstone2', 
  'neonlight', 'glitch', 'harrypotter', 'brokenglass', 'papercut', 'watercolor', 
  'multicolor', 'neondevil', 'underwater', 'graffitibike', 'snow', 'cloud', 
  'honey', 'ice', 'fruitjuice', 'biscuit', 'wood', 'chocolate', 'strawberry', 
  'matrix', 'blood', 'dropwater', 'toxic', 'lava', 'rock', 'bloodglas', 
  'halloween', 'darkgold', 'joker', 'wicker', 'firework', 'skeleton', 
  'blackpink', 'sand', 'glue', '1917', 'leaves'
];
export const description = 'Create text effects using TextPro API';
export const category = 'Creation';

// Mapping des effets avec leurs URLs
const textproEffects = {
  candy: 'https://textpro.me/create-christmas-candy-cane-text-effect-1056.html',
  christmas: 'https://textpro.me/christmas-tree-text-effect-online-free-1057.html',
  '3dchristmas': 'https://textpro.me/3d-christmas-text-effect-by-name-1055.html',
  sparklechristmas: 'https://textpro.me/sparkles-merry-christmas-text-effect-1054.html',
  deepsea: 'https://textpro.me/create-3d-deep-sea-metal-text-effect-online-1053.html',
  scifi: 'https://textpro.me/create-3d-sci-fi-text-effect-online-1050.html',
  rainbow: 'https://textpro.me/3d-rainbow-color-calligraphy-text-effect-1049.html',
  waterpipe: 'https://textpro.me/create-3d-water-pipe-text-effects-online-1048.html',
  spooky: 'https://textpro.me/create-halloween-skeleton-text-effect-online-1047.html',
  pencil: 'https://textpro.me/create-a-sketch-text-effect-online-1044.html',
  circuit: 'https://textpro.me/create-blue-circuit-style-text-effect-online-1043.html',
  discovery: 'https://textpro.me/create-space-text-effects-online-free-1042.html',
  metalic: 'https://textpro.me/creat-glossy-metalic-text-effect-free-online-1040.html',
  fiction: 'https://textpro.me/create-science-fiction-text-effect-online-free-1038.html',
  demon: 'https://textpro.me/create-green-horror-style-text-effect-online-1036.html',
  transformer: 'https://textpro.me/create-a-transformer-text-effect-online-1035.html',
  berry: 'https://textpro.me/create-berry-text-effect-online-free-1033.html',
  thunder: 'https://textpro.me/online-thunder-text-effect-generator-1031.html',
  magma: 'https://textpro.me/create-a-magma-hot-text-effect-online-1030.html',
  '3dstone2': 'https://textpro.me/create-a-3d-stone-text-effect-online-for-free-1073.html',
  neonlight: 'https://textpro.me/create-3d-neon-light-text-effect-online-1028.html',
  glitch: 'https://textpro.me/create-impressive-glitch-text-effects-online-1027.html',
  harrypotter: 'https://textpro.me/create-harry-potter-text-effect-online-1025.html',
  brokenglass: 'https://textpro.me/broken-glass-text-effect-free-online-1023.html',
  papercut: 'https://textpro.me/create-art-paper-cut-text-effect-online-1022.html',
  watercolor: 'https://textpro.me/create-a-free-online-watercolor-text-effect-1017.html',
  multicolor: 'https://textpro.me/online-multicolor-3d-paper-cut-text-effect-1016.html',
  neondevil: 'https://textpro.me/create-neon-devil-wings-text-effect-online-free-1014.html',
  underwater: 'https://textpro.me/3d-underwater-text-effect-generator-online-1013.html',
  graffitibike: 'https://textpro.me/create-wonderful-graffiti-art-text-effect-1011.html',
  snow: 'https://textpro.me/create-snow-text-effects-for-winter-holidays-1005.html',
  cloud: 'https://textpro.me/create-a-cloud-text-effect-on-the-sky-online-1004.html',
  honey: 'https://textpro.me/honey-text-effect-868.html',
  ice: 'https://textpro.me/ice-cold-text-effect-862.html',
  fruitjuice: 'https://textpro.me/fruit-juice-text-effect-861.html',
  biscuit: 'https://textpro.me/biscuit-text-effect-858.html',
  wood: 'https://textpro.me/wood-text-effect-856.html',
  chocolate: 'https://textpro.me/chocolate-cake-text-effect-890.html',
  strawberry: 'https://textpro.me/strawberry-text-effect-online-889.html',
  matrix: 'https://textpro.me/matrix-style-text-effect-online-884.html',
  blood: 'https://textpro.me/horror-blood-text-effect-online-883.html',
  dropwater: 'https://textpro.me/dropwater-text-effect-872.html',
  toxic: 'https://textpro.me/toxic-text-effect-online-901.html',
  lava: 'https://textpro.me/lava-text-effect-online-914.html',
  rock: 'https://textpro.me/rock-text-effect-online-915.html',
  bloodglas: 'https://textpro.me/blood-text-on-the-frosted-glass-941.html',
  halloween: 'https://textpro.me/halloween-fire-text-effect-940.html',
  darkgold: 'https://textpro.me/metal-dark-gold-text-effect-online-939.html',
  joker: 'https://textpro.me/create-logo-joker-online-934.html',
  wicker: 'https://textpro.me/wicker-text-effect-online-932.html',
  firework: 'https://textpro.me/firework-sparkle-text-effect-930.html',
  skeleton: 'https://textpro.me/skeleton-text-effect-online-929.html',
  blackpink: 'https://textpro.me/create-blackpink-logo-style-online-1001.html',
  sand: 'https://textpro.me/write-in-sand-summer-beach-free-online-991.html',
  glue: 'https://textpro.me/create-3d-glue-text-effect-with-realistic-style-986.html',
  '1917': 'https://textpro.me/1917-style-text-effect-online-980.html',
  leaves: 'https://textpro.me/natural-leaves-text-effect-931.html'
};

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;
  
  // Récupérer la commande utilisée
  const commandUsed = msg.body.split(' ')[0].slice(1).toLowerCase();
  
  // Si aucun argument n'est fourni, afficher l'aide
  if (!args || args.length === 0) {
    let helpText = '⚡ *SIGMA MDX DEPLOY TextPro Effects*\n\n';
    helpText += 'Usage: .<effect> <text>\n';
    helpText += 'Example: .candy Hello\n\n';
    helpText += 'Available effects:\n';
    
    // Afficher les effets par groupe de 5 pour une meilleure lisibilité
    const effectsList = Object.keys(textproEffects);
    for (let i = 0; i < effectsList.length; i += 5) {
      const chunk = effectsList.slice(i, i + 5);
      helpText += `é ${chunk.join(', ')}\n`;
    }
    
    return await sock.sendMessage(from, { text: helpText }, { quoted: msg });
  }

  // Vérifier si la commande est dans la liste des effets
  if (!textproEffects[commandUsed]) {
    return await sock.sendMessage(from, { 
      text: `? *SIGMA MDX DEPLOY*: Unknown effect "${commandUsed}"\nUse .textpro to see all available effects.`
    }, { quoted: msg });
  }

  const text = args.join(' ');
  const effectUrl = textproEffects[commandUsed];
  
  try {
    // Message d'attente
    const sentMsg = await sock.sendMessage(from, { 
      text: `⚡ *SIGMA MDX DEPLOY* - Creating ${commandUsed} effect...`
    }, { quoted: msg });

    // Utiliser mumaker pour générer l'effet
    // Note: Assurez-vous que mumaker est installé (npm install mumaker)
    const mumaker = require('mumaker');
    const result = await mumaker.textpro(effectUrl, text);
    
    if (!result || !result.image) {
      throw new Error('No image received from TextPro API');
    }

    // Envoyer l'image générée
    await sock.sendMessage(from, {
      image: { url: result.image },
      caption: `? *SIGMA MDX DEPLOY* - ${commandUsed.toUpperCase()} Effect\nText: ${text}`
    }, { quoted: sentMsg });

  } catch (err) {
    console.error(`? TextPro error (${commandUsed}):`, err);
    
    let errorMessage = `? *SIGMA MDX DEPLOY*: Failed to create ${commandUsed} effect\n`;
    
    if (err.message.includes('timeout') || err.message.includes('API')) {
      errorMessage += 'The TextPro service might be temporarily unavailable.';
    } else if (err.message.includes('No image')) {
      errorMessage += 'The effect generation failed. Try with different text.';
    } else {
      errorMessage += `Error: ${err.message}`;
    }
    
    await sock.sendMessage(from, { text: errorMessage }, { quoted: msg });
  }
}