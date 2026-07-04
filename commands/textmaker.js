export const name = "textmaker";
export const description = "Génére des images de texte stylisées";
export const category = "Création";

export async function execute(sock, msg, args) {
  try {
    const from = msg.key.remoteJid;
    
    if (!args || args.length < 2) {
      await sock.sendMessage(from, { 
        text: "+--? *AIDE* ?-\n" +
              "é ?? *Usage*: .textmaker <type> <texte>\n" +
              "é ?? *Exemple*: .textmaker metallic SIGMA MDX DEPLOY\n" +
              "é \n" +
              "é ?? *Types disponibles*:\n" +
              "é é metallic é ice é snow é impressive\n" +
              "é é matrix é light é neon é devil\n" +
              "é é purple é thunder é leaves é 1917\n" +
              "é é arena é hacker é sand é blackpink\n" +
              "é é glitch é fire\n" +
              "+-----------------"
      }, { quoted: msg });
      return;
    }

    const type = args[0].toLowerCase();
    const text = args.slice(1).join(' ');

    // Message d'attente
    const sentMsg = await sock.sendMessage(from, { 
      text: "⚡ *SIGMA MDX DEPLOY* - Génération de l'image en cours..." 
    }, { quoted: msg });

    let imageUrl;
    
    // Mapping des types de texte
    switch(type) {
      case 'metallic':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/impressive-decorative-3d-metal-text-effect-798.html", text);
        break;
      case 'ice':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/ice-text-effect-online-101.html", text);
        break;
      case 'snow':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/create-a-snow-3d-text-effect-free-online-621.html", text);
        break;
      case 'impressive':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/create-3d-colorful-paint-text-effect-online-801.html", text);
        break;
      case 'matrix':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/matrix-text-effect-154.html", text);
        break;
      case 'light':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html", text);
        break;
      case 'neon':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html", text);
        break;
      case 'devil':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html", text);
        break;
      case 'purple':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/purple-text-effect-online-100.html", text);
        break;
      case 'thunder':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/thunder-text-effect-online-97.html", text);
        break;
      case 'leaves':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/green-brush-text-effect-typography-maker-online-153.html", text);
        break;
      case '1917':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/1917-style-text-effect-523.html", text);
        break;
      case 'arena':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html", text);
        break;
      case 'hacker':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html", text);
        break;
      case 'sand':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html", text);
        break;
      case 'blackpink':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/create-a-blackpink-style-logo-with-members-signatures-810.html", text);
        break;
      case 'glitch':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/create-digital-glitch-text-effects-online-767.html", text);
        break;
      case 'fire':
        imageUrl = await mumaker.ephoto("https://en.ephoto360.com/flame-lettering-effect-372.html", text);
        break;
      default:
        await sock.sendMessage(from, {
          text: "+--? *ERREUR* ?-\n" +
                "é ?? *SIGMA MDX DEPLOY*: Type non reconnu\n" +
                "é ?? Utilise .textmaker sans arguments\n" +
                "é pour voir les types disponibles\n" +
                "+-----------------"
        }, { quoted: sentMsg });
        return;
    }

    // Envoi de l'image générée
    await sock.sendMessage(from, {
      image: { url: imageUrl.image },
      caption: `+--? *SIGMA MDX DEPLOY* ?-\n` +
               `é ?? *Type*: ${type}\n` +
               `é ?? *Texte*: ${text}\n` +
               `é \n` +
               `é ? Image générée avec succés\n` +
               `+-----------------`
    }, { quoted: sentMsg });

  } catch (err) {
    console.error("? Erreur textmaker :", err);
    await sock.sendMessage(msg.key.remoteJid, {
      text: "+--? *ERREUR* ?-\n" +
            "é ?? *SIGMA MDX DEPLOY*: Impossible de générer l'image\n" +
            "é ?? Vérifie la connexion ou réessaie plus tard\n" +
            "+-----------------"
    }, { quoted: msg });
  }
}