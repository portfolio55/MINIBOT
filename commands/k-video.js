export const name = "k-video";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  const textMsg =
    msg.message?.conversation?.trim() ||
    msg.message?.extendedTextMessage?.text?.trim() ||
    msg.message?.imageMessage?.caption?.trim() ||
    msg.message?.videoMessage?.caption?.trim() ||
    "";

  const used = (textMsg.split(/\s+/)[0] || ".k-video");
  const prompt = textMsg.slice(used.length).trim();

  await sock.sendMessage(from, {
    text: `> ⚠️ SIGMA MDX DEPLOY : Génération de vidéo par IA (texte → vidéo) indisponible.\n\n` +
      `Aucune API gratuite fonctionnelle n'est disponible pour cette fonctionnalité pour le moment ` +
      `(les services testés sont payants ou hors service).${prompt ? `\n\nTon prompt : ${prompt}` : ""}\n\n` +
      `Essaie plutôt \`.imagine\` pour générer une image à partir d'un prompt.`
  }, { quoted: msg });
}
