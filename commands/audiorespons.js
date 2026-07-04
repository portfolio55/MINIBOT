export const name = "audiorespons";

export async function execute(sock, msg, args, from, botContext) {
  const action = args[0]?.toLowerCase().trim();

  // Get this bot's responsSystem from per-UUID registry
  const uuid = botContext?.uuid;
  const responsSystem = uuid && global.responsRegistry?.[uuid];

  try {
    if (!action) {
      const status = responsSystem?.status ? responsSystem.status() : { active: false };
      return await sock.sendMessage(from, {
        text: `> 📊 *AUDIORESPONS STATUT*\n` +
              `• Système: ${status.active ? '🟢 ACTIF' : '🔴 INACTIF'}\n` +
              `• Fichier audio: ${status.audioFile || 'Non trouvé'}\n\n` +
              `Usage: \`.audiorespons on/off\``
      }, { quoted: msg });
    }

    if (action !== "on" && action !== "off") {
      return await sock.sendMessage(from, {
        text: `> ⚠️ Commande incorrecte.\nUsage: \`.audiorespons on/off\``
      }, { quoted: msg });
    }

    if (!responsSystem || typeof responsSystem.toggle !== 'function') {
      return await sock.sendMessage(from, {
        text: "> ⚠️ Système de réponse audio non initialisé. Redémarre le bot."
      }, { quoted: msg });
    }

    const currentStatus = responsSystem.status().active;
    const desiredStatus = (action === 'on');

    if (currentStatus !== desiredStatus) {
      const newStatus = responsSystem.toggle();
      await sock.sendMessage(from, {
        text: `> ✅ Audiorespons *${desiredStatus ? 'activé' : 'désactivé'}* !\nStatut: ${newStatus ? '🟢 ACTIF' : '🔴 INACTIF'}`
      }, { quoted: msg });
    } else {
      await sock.sendMessage(from, {
        text: `> ℹ️ Audiorespons déjà *${desiredStatus ? 'activé' : 'désactivé'}*.`
      }, { quoted: msg });
    }

  } catch (err) {
    console.error("❌ Erreur audiorespons:", err);
    await sock.sendMessage(from, {
      text: `> ⚠️ Erreur: ${err.message}`
    }, { quoted: msg });
  }
}
