export const name = "muscu";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    const muscle = args[0]?.toLowerCase() || "biceps";
    
    const RAPIDAPI_KEY = 'TON_API_KEY';
    if (RAPIDAPI_KEY === 'TON_API_KEY') {
      await sock.sendMessage(from, {
        text: "> SIGMA MDX DEPLOY: ❌ Cette commande nécessite une clé API RapidAPI non configurée.\nContactez l'administrateur."
      }, { quoted: msg });
      return;
    }

    const url = `https://exercisedb.p.rapidapi.com/exercises/target/${muscle}`;
    
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': 'TON_API_KEY',
        'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
      }
    });
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      await sock.sendMessage(from, { text: "> ❌ SIGMA MDX DEPLOY : Exercice non trouvé." }, { quoted: msg });
      return;
    }
    
    const exercise = data[0];
    
    const reply = `> 🎨 SIGMA MDX DEPLOY : ${exercise.name}
🎨🎨🎨🎨🎨🎨
?? Cible: ${exercise.target}
?? Muscle: ${exercise.bodyPart}
?? équipement: ${exercise.equipment}
?? Instructions: ${exercise.instructions?.split('.')[0] || "N/A"}...
?? Gif: ${exercise.gifUrl}`;
    
    await sock.sendMessage(from, { text: reply }, { quoted: msg });
    
  } catch (err) {
    console.error("Erreur exercise :", err);
    await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY : Service exercices indisponible." }, { quoted: msg });
  }
}