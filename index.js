const { Telegraf } = require('telegraf');

// Ключи берутся из защищенного хранилища хостинга, а не хранятся в коде
const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const bot = new Telegraf(BOT_TOKEN);

const helpText = 
  "📜 Доступные команды DarkAi:\n\n" +
  "• /start — Запустить бота\n" +
  "• /help — Список команд\n" +
  "• /img <запрос> — Сгенерировать картинку";

bot.start((ctx) => ctx.reply(`Привет! Я DarkAi, чем могу помочь? 🤖\n\n${helpText}`));
bot.help((ctx) => ctx.reply(helpText));

bot.command('img', async (ctx) => {
  const text = ctx.message.text;
  const prompt = text.replace('/img', '').trim();
  if (!prompt) {
    return ctx.reply("Пожалуйста, укажите описание для картинки!");
  }

  await ctx.reply("🎨 Генерирую изображение, подождите...");
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
  await ctx.replyWithPhoto(imageUrl, { caption: `Запрос: "${prompt}"` });
});

bot.on('text', async (ctx) => {
  const userText = ctx.message.text;
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://telegram.org",
        "X-Title": "DarkAi Bot"
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [{ role: "user", content: userText }]
      })
    });

    const data = await response.json();
    const replyText = data.choices?.[0]?.message?.content || "Не удалось получить ответ от ИИ.";
    await ctx.reply(replyText);
  } catch (error) {
    console.error("Ошибка:", error);
    await ctx.reply("Произошла ошибка при связи с ИИ.");
  }
});

bot.launch();
console.log("Бот запущен!");
