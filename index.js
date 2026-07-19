# সজীব ভাইয়ের ডাবল-কানেকশন, স্প্যাম প্রোটেক্টেড ও চ্যানেল ভেরিফিকেশনসহ মাল্টি-ইউজার কোড
js_code = """
const { Bot, InlineKeyboard, Keyboard, InputFile } = require("grammy");
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const QRCode = require("qrcode");
const fs = require("fs");

const bot = new Bot("8675187156:AAFoeJ3kuy9y95RDwi463o3RUkZQSnpvcF8");
const CHANNEL_USERNAME = "@airdrop_huntersbd2025"; 
const userSessions = {}; 

// সুরক্ষিত সাবস্ক্রিপশন চেক ফাংশন
async function checkSubscription(userId) {
    try {
        const member = await bot.api.getChatMember(CHANNEL_USERNAME, userId);
        const status = member.status;
        return ["creator", "administrator", "member"].includes(status);
    } catch (error) {
        console.log(`Subscription Check Error for ${userId}: বটের পারমিশন বা চ্যানেল আইডি চেক করুন।`);
        return false; 
    }
}

async function connectToWhatsApp(chatId) {
    if (userSessions[chatId] && (userSessions[chatId].isWaConnected || userSessions[chatId].isConnecting)) {
        console.log(`User ${chatId} already connected or connecting. Skipping.`);
        return;
    }

    if (!userSessions[chatId]) {
        userSessions[chatId] = {
            sock: null,
            isWaConnected: false,
            msgSent: false,
            isConnecting: true,
            qrSentTime: 0 // কিউআর স্প্যাম প্রোটেকশনের জন্য টাইমস্ট্যাম্প
        };
    } else {
        userSessions[chatId].isConnecting = true;
    }

    const { state, saveCreds } = await useMultiFileAuthState(`auth_info_${chatId}`);
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Sajib Validator Pro", "Chrome", "1.0.0"]
    });

    userSessions[chatId].sock = sock;

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // কিউআর কোড স্প্যাম প্রোটেকশন লজিক (১ মিনিটের ভেতর বারবার কিউআর পাঠাবে না)
        if (qr && !userSessions[chatId].isWaConnected) {
            const now = Date.now();
            if (now - userSessions[chatId].qrSentTime > 45000) { // ৪৫ সেকেন্ডের সেফটি বাফার
                userSessions[chatId].qrSentTime = now;
                try {
                    const qrPath = `qrcode_${chatId}.png`;
                    await QRCode.toFile(qrPath, qr);
                    await bot.api.sendPhoto(chatId, new InputFile(qrPath), {
                        caption: "📸 **আপনার আসল হোয়াটসঅ্যাপ QR কোড রেডি!**\\n\\n১. আপনার ফোনের WhatsApp ওপেন করুন।\\n২. Linked Devices-এ গিয়ে এই QR কোডটি স্ক্যান করুন।"
                    });
                    if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
                } catch (err) {
                    console.log(`QR Send Error for User ${chatId}: `, err);
                }
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            userSessions[chatId].isWaConnected = false;
            userSessions[chatId].isConnecting = false;
            userSessions[chatId].msgSent = false;
            
            if (shouldReconnect) {
                // কানেকশন ড্রপ করলে ২ সেকেন্ড ডিলে দিয়ে রিকানেক্ট করবে যাতে লুপ না লাগে
                setTimeout(() => connectToWhatsApp(chatId), 2000);
            } else {
                delete userSessions[chatId];
                try {
                    fs.rmSync(`auth_info_${chatId}`, { recursive: true, force: true });
                } catch (e) {}
            }
        } else if (connection === 'open') {
            userSessions[chatId].isWaConnected = true;
            userSessions[chatId].isConnecting = false;
            
            if (!userSessions[chatId].msgSent) {
                await bot.api.sendMessage(chatId, "✅ **সফলভাবে লিঙ্ক হয়েছে!** আপনার হোয়াটসঅ্যাপ এখন লাইভ। এখন নম্বরের লিস্ট পাঠান।", { reply_markup: menu });
                userSessions[chatId].msgSent = true; 
            }
        }
    });
}

// মূল রিপ্লাই কিবোর্ড মেনু
const menu = {
    keyboard: [
        [{ text: "📱 Link WhatsApp (QR)" }, { text: "🔍 Start Checking" }],
        [{ text: "⚙️ Check My Connection" }, { text: "📖 Rules / How to use" }],
        [{ text: "👨‍💻 Admin / Support" }]
    ],
    resize_keyboard: true
};

// চ্যানেল জয়েন করার ইনলাইন ভেরিফিকেশন কিবোর্ড
const getVerifyKeyboard = () => {
    return new InlineKeyboard()
        .url("📢 আমাদের চ্যানেলে জয়েন করুন", `https://t.me/${CHANNEL_USERNAME.replace('@', '')}`).row()
        .text("✅ ভেরিফাই (Verify) করুন", "verify_sub");
}

bot.command("start", async (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    
    // প্রথমে সাবস্ক্রিপশন চেক
    const isSubscribed = await checkSubscription(userId);
    if (!isSubscribed) {
        await ctx.reply(`👑 **SAJIB'S ELITE VALIDATOR** 👑\\n\\nসজীব ভাই, বটটি ব্যবহার করার জন্য দয়া করে আমাদের চ্যানেলে জয়েন করুন।\\n\\nজয়েন করার পর নিচের বাটনটিতে ক্লিক করে **ভেরিফাই** করুন।`, { reply_markup: getVerifyKeyboard() });
        return;
    }

    const isConnected = userSessions[chatId] ? userSessions[chatId].isWaConnected : false;
    if (userSessions[chatId]) {
        userSessions[chatId].msgSent = false; 
    }
    
    await ctx.reply(`⚡ ════ 𝐖𝐇𝐀𝐓𝐒𝐀𝐏𝐏 𝐕𝐀𝐋𝐈𝐃𝐀𝐓𝐎𝐑 𝐏𝐑𝐎 ════ ⚡\\n\\n👤 **Owner:** MD ARIFUL ISLAM SAJIB\\n\\n🟢 **আপনার স্ট্যাটাস:** \${isConnected ? "✅ লিঙ্কড" : "❌ ডিসকানেক্টেড"}\\n\\n👉 নিচে বাটনগুলো দেওয়া হলো, আপনার প্রয়োজন মতো ক্লিক করুন।`, { reply_markup: menu });
});

// ইনলাইন ভেরিফিকেশন বাটন হ্যান্ডলার
bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    if (data === "verify_sub") {
        const isSubscribed = await checkSubscription(userId);
        if (isSubscribed) {
            const isConnected = userSessions[chatId] ? userSessions[chatId].isWaConnected : false;
            await ctx.answerCallbackQuery({ text: "✅ ভেরিফাই সফল হয়েছে!", show_alert: true });
            await ctx.deleteMessage();
            await ctx.reply(`👑 **SAJIB'S ELITE VALIDATOR** 👑\\n\\nভেরিফাই সফল হয়েছে! সজীব ভাই, আপনার অ্যাক্সেস আনলক করা হলো।`, { reply_markup: menu });
        } else {
            await ctx.answerCallbackQuery({ text: "❌ সজীব ভাই, আপনি এখনও চ্যানেলে জয়েন করেননি!", show_alert: true });
        }
        return; 
    }
});

bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();

    // প্রতিটি বাটন প্রেস করার সময় সাবস্ক্রিপশন জোরপূর্বক চেক করবে
    const isSubscribed = await checkSubscription(userId);
    if (!isSubscribed) {
        await ctx.reply(`👑 **SAJIB'S ELITE VALIDATOR** 👑\\n\\nসজীব ভাই! আমাদের চ্যানেলে জয়েন না করলে আপনি বটের বাটন ব্যবহার করতে পারবেন না।`, { reply_markup: getVerifyKeyboard() });
        return;
    }

    const isConnected = userSessions[chatId] ? userSessions[chatId].isWaConnected : false;

    if (text === "📱 Link WhatsApp (QR)") {
        if (isConnected) return ctx.reply("✅ সজীব ভাই, আপনার হোয়াটসঅ্যাপ অলরেডি কানেক্টেড আছে!");
        if (userSessions[chatId]) userSessions[chatId].msgSent = false;
        await ctx.reply("🔄 আপনার জন্য কিউআর কোড জেনারেট হচ্ছে, ২ সেকেন্ড অপেক্ষা করুন...");
        connectToWhatsApp(chatId);
        return;
    }

    if (text === "⚙️ Check My Connection") {
        return ctx.reply(isConnected ? "✅ আপনার হোয়াটসঅ্যাপ সম্পূর্ণ লাইভ যুক্ত আছে।" : "❌ votre কোনো হোয়াটসঅ্যাপ যুক্ত করা নেই।", { reply_markup: menu });
    }

    if (text === "👨‍💻 Admin / Support") {
        return ctx.reply("👨‍💻 **এডমিন সাপোর্ট:**\\n\\nযেকোনো দরকারে সরাসরি আমার সাথে যোগাযোগ করুন:\\n👉 **টেলিগ্রাম:** @MD_ARIFUL_BD", { reply_markup: menu });
    }

    if (text === "📖 Rules / How to use") {
        return ctx.reply("📖 **ব্যবহারের নিয়ম:**\\n\\n১. প্রথমে '📱 Link WhatsApp (QR)' বাটনে চাপ দিয়ে কিউআর কোড স্ক্যান করুন।\\n২. কানেক্ট হলে '🔍 Start Checking' চাপুন অথবা সরাসরি কান্ট্রি কোড সহ নম্বরের লিস্টটি লাইন বাই লাইন পাঠিয়ে দিন।", { reply_markup: menu });
    }

    if (text === "🔍 Start Checking") {
        if (!isConnected) return ctx.reply("⚠️ আগে '📱 Link WhatsApp (QR)' বাটনে চেপে QR কোড স্ক্যান করে নিন।");
        return ctx.reply("📲 অনুগ্রহ করে কান্ট্রি কোডসহ নম্বরের লিস্টটি পাঠান (লাইন বাই লাইন):");
    }

    if (text.startsWith("/")) return;
    if (!isConnected) return ctx.reply("⚠️ আগে '📱 Link WhatsApp (QR)' বাটনে চেপে QR কোড স্ক্যান করে নিন।");

    const lines = text.split("\\n");
    let numbers = [];
    for (let line of lines) {
        let cleaned = line.replace(/\\D/g, "");
        if (cleaned.length > 5) numbers.push(cleaned);
    }
    if (numbers.length === 0) return ctx.reply("❌ কোনো বৈধ নম্বর পাওয়া যায়নি।");

    await ctx.reply(`⏳ \${numbers.length}টি নম্বর লাইভ চেক করা হচ্ছে আপনার হোয়াটসঅ্যাপ দিয়ে...`);
    let activeNumbers = [];
    let inactiveNumbers = [];

    const currentSock = userSessions[chatId].sock;

    for (let num of numbers) {
        try {
            const [result] = await currentSock.onWhatsApp(num);
            if (result && result.exists) {
                activeNumbers.push("🟢 +" + result.jid.split("@")[0]);
            } else {
                inactiveNumbers.push("🔴 +" + num);
            }
        } catch (err) {
            inactiveNumbers.push("🔴 +" + num);
        }
    }

    let responseText = `📊 **WHATSAPP REPORT** 📊\\n\\n🟢 **Active (\${activeNumbers.length}):**\\n` + 
                       (activeNumbers.length > 0 ? activeNumbers.join("\\n") : "নেই") + 
                       `\\n\\n🔴 **Inactive (\${inactiveNumbers.length}):**\\n` + 
                       (inactiveNumbers.length > 0 ? inactiveNumbers.join("\\n") : "নেই") + 
                       `\\n\\n🟢 **COMPLETED BY SAJIB BOT!**`;
    
    await ctx.reply(responseText, { reply_markup: menu });
});

if (fs.existsSync('.')) {
    fs.readdirSync('.').forEach(file => {
        if (file.startsWith('auth_info_')) {
            const chatId = file.replace('auth_info_', '');
            if (!isNaN(chatId) && chatId.trim() !== "") {
                console.log(`Auto-reloading session for user: \${chatId}`);
                connectToWhatsApp(chatId).catch(() => {});
            }
        }
    });
}

bot.start();
console.log("🚀 Multi-user bot server is live successfully with Verification and Spam protection!");
"""

# ফাইল রাইট করা
with open("server.js", "w", encoding="utf-8") as f:
    f.write(js_code)

# ডিপেন্ডেন্সি ইনস্টল ও রান করা
!npm install grammy @whiskeysockets/baileys pino qrcode
!node server.js
