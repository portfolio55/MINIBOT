const sigmaChatIBState = new Map();

export default {
  name: "sigmachat-ib",
  description: "Activer/désactiver SigmaChat en DM (IB)",
  cooldown: 3,
  isOwner: true,

  async execute(sock, msg, args, from, botContext) {
    if (!from) from = msg.key.remoteJid;
    const uuid = botContext?.uuid || "default";

    try {
      if (!sigmaChatIBState.has(uuid)) sigmaChatIBState.set(uuid, { enabled: true });
      const state = sigmaChatIBState.get(uuid);

      if (!args[0]) {
        await sock.sendMessage(from, {
          text: `> SIGMA MDX DEPLOY: SigmaChat en DM (IB)*\n\n` +
                `Statut : ${state.enabled ? "Activé" : "Désactivé"}\n\n` +
                `Utilisation :\n` +
                `» \`.sigmachat-ib on\` → Activer\n` +
                `» \`.sigmachat-ib off\` → Désactiver\n` +
                `» \`.sigmachat-ib status\` → Voir l'état`
        }, { quoted: msg });
        return;
      }

      const action = args[0].toLowerCase();

      if (action === "on") {
        state.enabled = true;
        await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY: SigmaChat en DM (IB) activé !" }, { quoted: msg });
      } else if (action === "off") {
        state.enabled = false;
        await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY: SigmaChat en DM (IB) désactivé !" }, { quoted: msg });
      } else if (action === "status") {
        await sock.sendMessage(from, {
          text: `> Statut SigmaChat en DM : ${state.enabled ? "Activé" : "Désactivé"}`
        }, { quoted: msg });
      } else {
        await sock.sendMessage(from, {
          text: "> SIGMA MDX DEPLOY: Commande inconnue. Utilise `on`, `off` ou `status`."
        }, { quoted: msg });
      }
    } catch (err) {
      await sock.sendMessage(from, { text: `> ❌ Erreur sigmachat-ib: ${err.message}` }, { quoted: msg });
    }
  }
};
