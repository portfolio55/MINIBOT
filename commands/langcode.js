export const name = "langcode";

const LANG_LIST = `🌍 *Codes langue ISO 639-1* 🌍
━━━━━━━━━━━━━━━━━━━
🇦🇫 *Pashto* ➝ ps
🇦🇱 *Albanian* ➝ sq
🇩🇿 *Arabic* ➝ ar
🇦🇲 *Armenian* ➝ hy
🇦🇺 *English* ➝ en
🇦🇿 *Azerbaijani* ➝ az
🇧🇩 *Bengali* ➝ bn
🇧🇬 *Bulgarian* ➝ bg
🇧🇷 *Portuguese* ➝ pt
🇨🇳 *Chinese* ➝ zh
🇨🇿 *Czech* ➝ cs
🇩🇪 *German* ➝ de
🇩🇰 *Danish* ➝ da
🇪🇸 *Spanish* ➝ es
🇫🇷 *French* ➝ fr
🇬🇷 *Greek* ➝ el
🇮🇩 *Indonesian* ➝ id
🇮🇹 *Italian* ➝ it
🇯🇵 *Japanese* ➝ ja
🇮🇳 *Hindi* ➝ hi
🇰🇷 *Korean* ➝ ko
🇳🇱 *Dutch* ➝ nl
🇳🇴 *Norwegian* ➝ no
🇵🇱 *Polish* ➝ pl
🇷🇺 *Russian* ➝ ru
🇸🇪 *Swedish* ➝ sv
🇹🇭 *Thai* ➝ th
🇹🇷 *Turkish* ➝ tr
🇺🇦 *Ukrainian* ➝ uk
🇿🇦 *Afrikaans* ➝ af
🇻🇳 *Vietnamese* ➝ vi
━━━━━━━━━━━━━━━━━━━
✅ Utilise ces codes pour la commande translate.`;

const LANG_IMG = "https://files.catbox.moe/hgg32i.jpg";

export async function execute(sock, msg, args, from) {
  try {
    await sock.sendMessage(from, { text: LANG_LIST }, { quoted: msg });
    try {
      await sock.sendMessage(from, { image: { url: LANG_IMG }, caption: LANG_LIST }, { quoted: msg });
    } catch (e) {
      console.warn("[langcode] Image non envoyée:", e?.message);
    }
  } catch (err) {
    console.error("❌ Erreur langcode:", err);
    await sock.sendMessage(from, { text: "❌ Erreur." }, { quoted: msg });
  }
}
