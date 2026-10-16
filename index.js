const { Telegraf, Markup } = require('telegraf');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 1. Веб-сервер заглушка, чтобы Render не закрывал порт
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('DarkAi Bot запущен и работает!');
}).listen(PORT, () => {
  console.log(`Веб-сервер запущен на порту ${PORT}`);
});

if (!BOT_TOKEN) {
  console.error("ОШИБКА: BOT_TOKEN не найден в переменных окружения!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Использование автоматического бесплатного роутера OpenRouter
const AI_MODEL = "openrouter/auto";

const helpMessage = 
  "✨ **Главное меню DarkAi** ✨\n\n" +
  "🤖 **Текст:** Просто отправьте мне любой вопрос или задачу.\n" +
  "🎨 **Картинки:** Нажмите кнопку ниже или напишите `/img <описание>`\n" +
  "ℹ️ **Информация:** Узнать возможности бота.";

const mainMenu = Markup.keyboard([
  ['🎨 Сгенерировать картинку', 'ℹ️ О боте'],
  ['📜 Справка']
]).resize();

bot.start(async (ctx) => {
  await ctx.reply(
    `Привет, ${ctx.from.first_name || 'друг'}! 👋\n\nЯ **DarkAi** — твой персональный ИИ-помощник.\n\n${helpMessage}`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

bot.help(async (ctx) => {
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

bot.hears('ℹ️ О боте', async (ctx) => {
  await ctx.reply(
    "🤖 **DarkAi Bot**\n\n" +
    "• **Текстовый ИИ:** Автоматический выбор бесплатной модели (OpenRouter Auto)\n" +
    "• **Генерация фото:** Pollinations AI\n" +
    "• **Скорость:** Высокая ⚡️",
    { parse_mode: 'Markdown' }
  );
});

bot.hears('📜 Справка', async (ctx) => {
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

bot.hears('🎨 Сгенерировать картинку', async (ctx) => {
  await ctx.reply("Чтобы сгенерировать картинку, напишите команду в формате:\n\n`/img неоновый город будущего`", { parse_mode: 'Markdown' });
});

// 2. Генерация изображений через Pollinations AI
bot.command('img', async (ctx) => {
  const text = ctx.message.text;
  const prompt = text.replace('/img', '').trim();
  
  if (!prompt) {
    return ctx.reply("⚠️ Пожалуйста, укажите описание! Пример:\n`/img киберпанк кот в очках`", { parse_mode: 'Markdown' });
  }

  const statusMsg = await ctx.reply("🎨 **Генерирую изображение...**\n⏳ *Подождите пару секунд...*", { parse_mode: 'Markdown' });

  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const randomSeed = Math.floor(Math.random() * 10000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${randomSeed}`;
    
    await ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    await ctx.replyWithPhoto(imageUrl, { 
      caption: `✨ **Результат по запросу:**\n_"${prompt}"_`,
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
});

// 3. Обработчик текстового диалога
bot.on('text', async (ctx) => {
  const userText = ctx.message.text;
  
  if (['🎨 Сгенерировать картинку', 'ℹ️ О боте', '📜 Справка'].includes(userText)) return;

  await ctx.sendChatAction('typing');
  const statusMsg = await ctx.reply("🧠 *Думаю над ответом...*", { parse_mode: 'Markdown' });

  try {
    const apiKey = OPENROUTER_API_KEY ? OPENROUTER_API_KEY.trim() : '';
    
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
            content: "Ты умный, вежливый и современный ИИ-помощник DarkAi. Отвечай подробно, красиво и с эмодзи." 
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
      `❌ Ошибка связи с ИИ: ${error.message}`
    );
  }
});

bot.launch();
console.log("Бот DarkAi запущен!");
