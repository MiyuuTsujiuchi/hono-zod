import { Hono } from 'hono';
import { z } from 'zod';
import axios from 'axios';
import { WebClient } from '@slack/web-api';

const app = new Hono();

// ニュースAPIのレスポンススキーマ
const NewsSchema = z.object({
  title: z.string(),
  description: z.string(),
  url: z.string().url(),
  publishedAt: z.string(),
});

app.post('/', async (c) => {
  try {
    // 環境変数のチェック
    if (!process.env.NEWS_API_KEY || !process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
      throw new Error('必要な環境変数が設定されていません');
    }

    // ニュースを取得（例としてNewsAPIを使用）
    const newsResponse = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        country: 'jp',
        apiKey: process.env.NEWS_API_KEY,
      },
    });

    // ニュースデータのバリデーション
    const news = NewsSchema.parse(newsResponse.data.articles[0]);

    // Slackクライアントの初期化
    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

    // Slackにメッセージを送信
    await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      text: `最新のニュースをお届けします！\n\n*${news.title}*\n${news.description}\n${news.url}`,
    });

    return c.json({ success: true, message: 'ニュースをSlackに送信しました' });
  } catch (error) {
    console.error('Error:', error);
    return c.json({ success: false, error: 'エラーが発生しました' }, 500);
  }
});

export const GET = app.fetch;
export const POST = app.fetch; 