const { cmd } = require('../command');
const axios = require('axios');

const GIFTED_AI_ENDPOINT = "https://api.giftedtech.co.ke/api/ai/ai";
const GIFTED_DEEPIMG_ENDPOINT = "https://api.giftedtech.co.ke/api/ai/deepimg";
const GIFTED_API_KEY = process.env.GIFTED_API_KEY || "gifted";

async function giftedAI(q) {
    const { data } = await axios.get(GIFTED_AI_ENDPOINT, {
        params: {
            apikey: GIFTED_API_KEY,
            q
        },
        timeout: 30000
    });
    return data;
}

async function giftedDeepImg(prompt) {
    const { data } = await axios.get(GIFTED_DEEPIMG_ENDPOINT, {
        params: {
            apikey: GIFTED_API_KEY,
            prompt
        },
        timeout: 60000
    });
    return data;
}

cmd({
    pattern: "ai",
    alias: ["bot"],
    desc: "Chat with an AI model",
    category: "ai",
    react: "🤖",
    filename: __filename
},
async (conn, mek, m, { from, args, q, reply, react }) => {
    try {
        if (!q) return reply("Please provide a message for the AI.\nExample: `.ai Hello`");

        const data = await giftedAI(q);

        if (!data || !data.result) {
            await react("❌");
            return reply("AI failed to respond. Please try again later.");
        }

        await reply(`🤖 *AI Response:*\n\n${data.result}`);
        await react("✅");
    } catch (e) {
        console.error("Error in AI command:", e);
        await react("❌");
        reply("An error occurred while communicating with the AI.");
    }
});

cmd({
    pattern: "imagine",
    alias: ["deepimg"],
    desc: "Generate an image with AI",
    category: "ai",
    react: "🖼️",
    filename: __filename
},
async (conn, mek, m, { from, args, q, reply, react }) => {
    try {
        if (!q) return reply("Please provide an image prompt.\nExample: `.imagine JESUS EN NOIR`");

        const data = await giftedDeepImg(q);
        const imgUrl = data && data.result;

        if (!imgUrl) {
            await react("❌");
            return reply("Image generation failed. Please try again later.");
        }

        await conn.sendMessage(from, { image: { url: imgUrl }, caption: `🖼️ *Prompt:* ${q}` }, { quoted: mek });
        await react("✅");
    } catch (e) {
        console.error("Error in imagine command:", e);
        await react("❌");
        reply("An error occurred while generating the image.");
    }
});

cmd({
    pattern: "openai",
    alias: ["chatgpt", "gpt3"],
    desc: "Chat with OpenAI",
    category: "ai",
    react: "🧠",
    filename: __filename
},
async (conn, mek, m, { from, args, q, reply, react }) => {
    try {
        if (!q) return reply("Please provide a message for OpenAI.\nExample: `.openai Hello`");

        const data = await giftedAI(q);

        if (!data || !data.result) {
            await react("❌");
            return reply("OpenAI failed to respond. Please try again later.");
        }

        await reply(`🧠 *AI Response:*\n\n${data.result}`);
        await react("✅");
    } catch (e) {
        console.error("Error in OpenAI command:", e);
        await react("❌");
        reply("An error occurred while communicating with OpenAI.");
    }
});

cmd({
    pattern: "deepseek",
    alias: ["deep", "seekai"],
    desc: "Chat with DeepSeek AI",
    category: "ai",
    react: "🧠",
    filename: __filename
},
async (conn, mek, m, { from, args, q, reply, react }) => {
    try {
        if (!q) return reply("Please provide a message for DeepSeek AI.\nExample: `.deepseek Hello`");

        const data = await giftedAI(q);

        if (!data || !data.result) {
            await react("❌");
            return reply("DeepSeek AI failed to respond. Please try again later.");
        }

        await reply(`🧠 *AI Response:*\n\n${data.result}`);
        await react("✅");
    } catch (e) {
        console.error("Error in DeepSeek AI command:", e);
        await react("❌");
        reply("An error occurred while communicating with DeepSeek AI.");
    }
});
