export const name = "film";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    if (!args.length) {
      await sock.sendMessage(from, { 
        text: "> ?? SIGMA MDX DEPLOY : Usage: !film <titre> [année]\nEx: !film Inception 2010" 
      }, { quoted: msg });
      return;
    }
    
    const search = args.join(" ");
    
    // API OMDb (gratuit 1000 req/jour)
    const API_KEY = "TON_API_KEY";
    if (API_KEY === "TON_API_KEY" || API_KEY === "YOUR_API_KEY") {
      await sock.sendMessage(from, {
        text: "> SIGMA MDX DEPLOY: ❌ Cette commande nécessite une clé API non configurée.\nContactez l'administrateur."
      }, { quoted: msg });
      return;
    } // omdbapi.com
    const url = `https://www.omdbapi.com/?t=${encodeURIComponent(search)}&apikey=${API_KEY}&plot=short`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.Response === "False") {
      await sock.sendMessage(from, { text: "> ❌ SIGMA MDX DEPLOY : Film non trouvé." }, { quoted: msg });
      return;
    }
    
    const reply = `> ?? SIGMA MDX DEPLOY : ${data.Title}
🎨🎨🎨🎨🎨🎨
?? Année: ${data.Year}
?? Genre: ${data.Genre}
? Durée: ${data.Runtime}
?? Réalisateur: ${data.Director}
?? Acteurs: ${data.Actors.split(',').slice(0,3).join(',')}
?? Note: ${data.imdbRating}/10 (${data.imdbVotes} votes)
🎨 Awards: ${data.Awards}
?? Synopsis: ${data.Plot.substring(0, 200)}...
?? IMDB: https://www.imdb.com/title/${data.imdbID}`;
    
    await sock.sendMessage(from, { text: reply }, { quoted: msg });
    
  } catch (err) {
    console.error("Erreur film :", err);
    await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY : Service films indisponible." }, { quoted: msg });
  }
}