export const name = "manga";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    if (!args.length) {
      await sock.sendMessage(from, { 
        text: "> ?? SIGMA MDX DEPLOY : Usage: !anime <nom>\nEx: !manga Naruto" 
      }, { quoted: msg });
      return;
    }
    
    const search = args.join(" ");
    
    // API Jikan (MyAnimeList)
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(search)}&limit=1`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      await sock.sendMessage(from, { text: "> ❌ SIGMA MDX DEPLOY : manga non trouvé." }, { quoted: msg });
      return;
    }
    
    const anime = data.data[0];
    
    const reply = `> ?? SIGMA MDX DEPLOY : ${anime.title}
🎨🎨🎨🎨🎨🎨
?? Type: ${anime.type}
?? Sortie: ${anime.year || "N/A"}
? Score: ${anime.score || "N/A"}
?? épisodes: ${anime.episodes || "En cours"}
?? Synopsis: ${anime.synopsis?.substring(0, 150) || "N/A"}...
?? ${anime.url}`;
    
    await sock.sendMessage(from, { text: reply }, { quoted: msg });
    
  } catch (err) {
    console.error("Erreur anime :", err);
    await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY : Service anime indisponible." }, { quoted: msg });
  }
}