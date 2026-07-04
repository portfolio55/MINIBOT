export const name = "styletext";
export const aliases = ["style"];
export const description = "Generate styled text variations";
export const category = "Text";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;
  
  if (!args.length) {
    return await sock.sendMessage(from, { 
      text: "⚡ *SIGMA MDX DEPLOY StyleText*\n\n" +
            "Usage: .styletext <text>\n" +
            "Alias: .style <text>\n\n" +
            "Example: .styletext Hello\n\n" +
            "Generates 6 different text styles"
    }, { quoted: msg });
  }

  const text = args.join(' ');
  
  try {
    // Message d'attente
    const sentMsg = await sock.sendMessage(from, { 
      text: "⚡ *SIGMA MDX DEPLOY* - Generating text styles..." 
    }, { quoted: msg });

    // Générer les variations de texte
    const styles = generateTextStyles(text);
    
    // Formater la réponse
    let response = `⚡ *SIGMA MDX DEPLOY StyleText*\n\n` +
                   `Original: ${text}\n\n`;
    
    styles.forEach((style, index) => {
      response += `${getEmoji(index + 1)} *${style.name}* : ${style.result}\n\n`;
    });
    
    await sock.sendMessage(from, { 
      text: response 
    }, { quoted: sentMsg });

  } catch (err) {
    console.error("StyleText Error:", err);
    await sock.sendMessage(from, { 
      text: "? *SIGMA MDX DEPLOY*: Error generating text styles\n" +
            "Please try again with different text"
    }, { quoted: msg });
  }
}

// Fonction pour générer les styles de texte
function generateTextStyles(text) {
  return [
    { name: "Uppercase", result: text.toUpperCase() },
    { name: "Lowercase", result: text.toLowerCase() },
    { name: "Alternating", result: alternatingCase(text) },
    { name: "Reversed", result: text.split('').reverse().join('') },
    { name: "Spaced", result: text.split('').join(' ') },
    { name: "Vaporwave", result: vaporwaveText(text) }
  ];
}

// Fonctions utilitaires pour les styles
function alternatingCase(text) {
  return text.split('').map((char, i) => 
    i % 2 === 0 ? char.toLowerCase() : char.toUpperCase()
  ).join('');
}

function vaporwaveText(text) {
  const vaporwaveMap = {
    'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd', 'e': 'e',
    'f': 'f', 'g': 'g', 'h': 'h', 'i': 'i', 'j': 'j',
    'k': 'k', 'l': 'l', 'm': 'm', 'n': 'n', 'o': 'o',
    'p': 'p', 'q': 'q', 'r': 'r', 's': 's', 't': 't',
    'u': 'u', 'v': 'v', 'w': 'w', 'x': 'x', 'y': 'y', 'z': 'z',
    'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E',
    'F': 'F', 'G': 'G', 'H': 'H', 'I': 'I', 'J': 'J',
    'K': 'K', 'L': 'L', 'M': 'M', 'N': 'N', 'O': 'O',
    'P': 'P', 'Q': 'Q', 'R': 'R', 'S': 'S', 'T': 'T',
    'U': 'U', 'V': 'V', 'W': 'W', 'X': 'X', 'Y': 'Y', 'Z': 'Z',
    '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
    '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
  };
  
  return text.split('').map(char => vaporwaveMap[char] || char).join('');
}

function getEmoji(number) {
  const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];
  return emojis[number - 1] || "⚡ ";
}