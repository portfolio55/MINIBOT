export const name = "game";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    if (!args.length) {
      await sock.sendMessage(from, { 
        text: "> ?? SIGMA MDX DEPLOY : Usage: !game <nom>\nEx: !game Minecraft" 
      }, { quoted: msg });
      return;
    }
    
    const search = args.join(" ");
    
    // API RAWG (gratuit 20k req/mois)
    const API_KEY = "TON_API_KEY";
    if (API_KEY === "TON_API_KEY" || API_KEY === "YOUR_API_KEY") {
      await sock.sendMessage(from, {
        text: "> SIGMA MDX DEPLOY: ❌ Cette commande nécessite une clé API non configurée.\nContactez l'administrateur."
      }, { quoted: msg });
      return;
    } // rawg.io/apidocs
    const url = `https://api.rawg.io/api/games?key=${API_KEY}&search=${encodeURIComponent(search)}&page_size=1`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      await sock.sendMessage(from, { text: "> ❌ SIGMA MDX DEPLOY : Jeu non trouvé." }, { quoted: msg });
      return;
    }
    
    const game = data.results[0];
    
    const reply = `> ?? SIGMA MDX DEPLOY : ${game.name}
🎨🎨🎨🎨🎨🎨
?? Sortie: ${game.released || "N/A"}
? Note: ${game.rating}/5
?? Plateformes: ${game.platforms?.map(p => p.platform.name).slice(0, 3).join(", ") || "N/A"}
🎨 Genres: ${game.genres?.map(g => g.name).slice(0, 3).join(", ") || "N/A"}
?? ${game.website || "Pas de site"}`;
    
    await sock.sendMessage(from, { text: reply }, { quoted: msg });
    
  } catch (err) {
    console.error("Erreur game :", err);
    await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY : Service jeux indisponible." }, { quoted: msg });
  }
}