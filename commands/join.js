export const name = "join";

export async function execute(sock, msg, args, from) {
  const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim();
  const link = args[0] || text.split(/\s+/)[1];
  if (!link || !link.includes("whatsapp.com")) {
    return await sock.sendMessage(from, {
      text: "❌ Envoie un lien d’invitation groupe.\nExemple : !join https://chat.whatsapp.com/xxxxx"
    }, { quoted: msg });
  }
  try {
    const code = link.split("https://chat.whatsapp.com/")[1]?.trim();
    if (!code) {
      return await sock.sendMessage(from, { text: "❌ Lien invalide." }, { quoted: msg });
    }
    await sock.groupAcceptInvite(code);
    await sock.sendMessage(from, { text: "✔️ Groupe rejoint avec succès." }, { quoted: msg });
  } catch (e) {
    console.error("Erreur join:", e);
    await sock.sendMessage(from, { text: "❌ Impossible de rejoindre le groupe." }, { quoted: msg });
  }
}
