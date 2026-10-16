const { Telegraf, Markup } = require('telegraf');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 1. Веб-сервер заглушка для Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('DarkAi Bot запущен и работает!');
}).listen(PORT, () => {
  console.log(`Веб-сервер запущен на порту ${PORT}`);
});

if (!BOT_TOKEN) {
  console.error("ОШИБКА: BOT_TOKEN не найден!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const AI_MODEL = "openrouter/auto";

const helpMessage = 
  "✨ **Главное меню DarkAi** ✨\n\n" +
  "🤖 **Текст:** Пишите любые вопросы на русском или украинском.\n" +
  "🎨 **Картинки:** Команда `/img <описание>` ИЛИ просто *«нарисуй...»* / *«намалюй...»*.\n" +
  "ℹ️ **Информация:** Узнать возможности бота.";

const mainMenu = Markup.keyboard([
  ['🎨 Сгенерировать картинку', 'ℹ️ О боте'],
  ['📜 Справка']
]).resize();

bot.start(async (ctx) => {
  await ctx.reply(
    `Привет! 👋 Я **DarkAi** — твой персональный ИИ-помощник.\n\n${helpMessage}`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

bot.help(async (ctx) => {
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

bot.hears('ℹ️ О боте', async (ctx) => {
  await ctx.reply(
    "🤖 **DarkAi Bot**\n\n" +
    "• **Языки:** Русский, Українська 🇷🇺🇺🇦\n" +
    "• **Текстовый ИИ:** OpenRouter Auto\n" +
    "• **Генерация фото:** Pollinations AI 🎨",
    { parse_mode: 'Markdown' }
  );
});

bot.hears('📜 Справка', async (ctx) => {
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

bot.hears('🎨 Сгенерировать картинку', async (ctx) => {
  await ctx.reply("Чтобы сгенерировать картинку, напишите:\n`/img кабан в лісі`\nИли просто:\n*«Нарисуй кота»* / *«Намалюй вовка»*", { parse_mode: 'Markdown' });
});

// Умная генерация с точным пониманием русского и украинского языков
async function generateAndSendImage(ctx, userPrompt) {
  const statusMsg = await ctx.reply("🎨 **Перевожу запрос и настраиваю генератор...**\n⏳ *Подождите пару секунд...*", { parse_mode: 'Markdown' });

  try {
    const apiKey = OPENROUTER_API_KEY ? OPENROUTER_API_KEY.trim() : '';
    
    // Промпт-инструкция для точного перевода с русского/украинского
    const translationResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://t.me/DarkAiBot",
        "X-Title": "DarkAi Bot"
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { 
            role: "system", 
            content: "You are an expert prompt engineer for AI image generators. The user will provide a text description in Russian or Ukrainian. Translate their exact description accurately into a clear, detailed English prompt for an image generator (like Stable Diffusion / Midjourney). Preserve all specific objects, styles, colors, and atmosphere requested by the user. Do not add random characters or change the core subject. Output ONLY the final English prompt, nothing else." 
          },
          { role: "user", content: userPrompt }
        ]
      })
    });

    const translationData = await translationResponse.json();
    let finalPrompt = translationData.choices?.[0]?.message?.content || userPrompt;
    finalPrompt = finalPrompt.replace(/^["']|["']$/g, '').trim();

    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      statusMsg.message_id, 
      null, 
      "🎨 **Генерирую изображение...**\n⏳ *Почти готово...*", 
      { parse_mode: 'Markdown' }
    ).catch(() => {});

    const encodedPrompt = encodeURIComponent(finalPrompt);
    const randomSeed = Math.floor(Math.random() * 10000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${randomSeed}`;
    
    await ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    await ctx.replyWithPhoto(imageUrl, { 
      caption: `✨ **Запрос:** _"${userPrompt}"_\n\n⚙️ **Промпт:** \`${finalPrompt}\``,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error("Ошибка при генерации картинки:", error);
    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      statusMsg.message_id, 
      null, 
      "❌ Не удалось сгенерировать картинку. Попробуйте другой запрос."
    );
  }
}

// Команда /img
bot.command('img', async (ctx) => {
  const text = ctx.message.text;
  const prompt = text.replace('/img', '').trim();
  
  if (!prompt) {
    return ctx.reply("⚠️ Укажите описание! Пример:\n`/img кабан в лісі`", { parse_mode: 'Markdown' });
  }

  await generateAndSendImage(ctx, prompt);
});

// Умный текстовый роутер (диалог + поддержка русских и украинских триггеров)
bot.on('text', async (ctx) => {
  const userText = ctx.message.text;
  
  if (['🎨 Сгенерировать картинку', 'ℹ️ О боте', '📜 Справка'].includes(userText)) return;

  const lowerText = userText.toLowerCase();
  
  // Ключевые слова на русском и украинском языках для авто-генерации
  const drawKeywords = [
    'нарисуй', 'сгенерируй', 'создай фото', 'создай картинку', 'нарисуй картинку', 'сделай картинку',
    'намалюй', 'згенеруй', 'створи фото', 'створи картинку', 'зроби картинку'
  ];
  
  const isDrawRequest = drawKeywords.some(keyword => lowerText.startsWith(keyword));

  if (isDrawRequest) {
    let cleanPrompt = userText;
    drawKeywords.forEach(keyword => {
      const reg = new RegExp(`^${keyword}`, 'i');
      cleanPrompt = cleanPrompt.replace(reg, '').trim();
    });

    if (!cleanPrompt) {
      return ctx.reply("⚠️ Напишите, что именно нарисовать / намалювати! Например:\n*Нарисуй замок в горах* / *Намалюй замок в горах*", { parse_mode: 'Markdown' });
    }

    return await generateAndSendImage(ctx, cleanPrompt);
  }

  // Обычный текстовый диалог с поддержкой языка пользователя
  await ctx.sendChatAction('typing');
  const statusMsg = await ctx.reply("🧠 *Думаю над ответом...*", { parse_mode: 'Markdown' });

  try {
    const apiKey = OPENROUTER_API_KEY ? OPENROUTER_API_KEY.trim() : '';
    const currentDate = new Date().toLocaleDateString('ru-RU', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://t.me/DarkAiBot",
        "X-Title": "DarkAi Bot"
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { 
            role: "system", 
            content: `Ты вежливый, дружелюбный и умный ИИ-помощник DarkAi. Всегда отвечай на том же языке, на котором пишет пользователь (русский или украинский). Сегодняшняя дата: ${currentDate}.` 
          },
          { role: "user", content: userText }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Ошибка API");
    }

    const replyText = data.choices?.[0]?.message?.content || "❌ Не удалось получить ответ от ИИ.";

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      replyText,
      { parse_mode: 'Markdown' }
    ).catch(async () => {
      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, replyText);
    });

  } catch (error) {
    console.error("Ошибка ИИ:", error);
    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      statusMsg.message_id, 
      null, 
      `❌ Помилка зв'язку з ШІ / Ошибка связи с ИИ: ${error.message}`
    );
  }
});

bot.launch();
console.log("Бот DarkAi запущен!");
