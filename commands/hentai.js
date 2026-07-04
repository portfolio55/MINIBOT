export const name = 'hentai';
export const aliases = ['hneko'];
export const description = 'Get NSFW neko images with next button';
export const category = 'NSFW';

export async function execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    
    // Vérification groupe
    if (!from.endsWith('@g.us')) {
        return await sock.sendMessage(from, {
            text: '? *SIGMA MDX DEPLOY*: This command only works in groups'
        }, { quoted: msg });
    }

    try {
        // Message d'attente
        const sentMsg = await sock.sendMessage(from, {
            text: '⚡ *SIGMA MDX DEPLOY* - Fetching hentai neko...'
        }, { quoted: msg });

        // Fetch de l'API
        const axios = require('axios');
        const response = await axios.get('https://waifu.pics/api/nsfw/neko');
        
        if (!response.data || !response.data.url) {
            throw new Error('No image URL received from API');
        }

        // Créer le message avec bouton
        const buttonMessage = {
            image: { url: response.data.url },
            caption: '⚡ *Hentai Neko* - SIGMA MDX DEPLOY',
            footer: 'Click "Next" for another image',
            buttons: [
                {
                    buttonId: '.hneko',
                    buttonText: { displayText: 'Next ?' },
                    type: 1
                }
            ],
            headerType: 1
        };

        await sock.sendMessage(from, buttonMessage, { quoted: sentMsg });

    } catch (err) {
        console.error('? Hentai-neko error:', err);
        
        let errorMessage = '? *SIGMA MDX DEPLOY*: Failed to fetch image';
        if (err.code === 'ECONNREFUSED' || err.message.includes('network')) {
            errorMessage += '\nAPI might be temporarily down';
        }

        await sock.sendMessage(from, {
            text: errorMessage
        }, { quoted: msg });
    }
}