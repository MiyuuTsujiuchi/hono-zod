import { Hono } from 'hono';
import { z } from 'zod';
import Parser from 'rss-parser';
import { WebClient } from '@slack/web-api';

const app = new Hono();

// RSSフィードのパーサー
const parser = new Parser();

// ポッドキャストエピソードのスキーマ
const PodcastSchema = z.object({
  title: z.string(),
  content: z.string(),
  link: z.string().url(),
  pubDate: z.string(),
});

app.post('/', async (c) => {
  try {
    // 環境変数のチェック
    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
      throw new Error('必要な環境変数が設定されていません');
    }

    // Lex FridmanのポッドキャストRSSフィードを取得
    const feed = await parser.parseURL('https://lexfridman.com/feed/podcast/');
    
    // 最新のエピソードを取得
    const latestEpisode = PodcastSchema.parse(feed.items[0]);

    // エピソードの説明を日本語に翻訳（ここでは簡易的な翻訳を実装）
    const translateToJapanese = (text: string) => {
      // 実際の翻訳APIを使用する場合は、ここでAPIを呼び出す
      // 例: DeepL API, Google Translate APIなど
      return `[日本語訳]\n${text}`;
    };

    const translatedContent = translateToJapanese(latestEpisode.content);

    // Slackクライアントの初期化
    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

    // Slackにメッセージを送信
    await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📢 Lex Fridman Podcast 最新エピソード',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${latestEpisode.title}*\n\n${translatedContent}\n\n<${latestEpisode.link}|エピソードを聴く>`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `公開日: ${new Date(latestEpisode.pubDate).toLocaleDateString('ja-JP')}`
            }
          ]
        }
      ]
    });

    return c.json({ success: true, message: 'ポッドキャスト情報をSlackに送信しました' });
  } catch (error) {
    console.error('Error:', error);
    return c.json({ success: false, error: 'エラーが発生しました' }, 500);
  }
});

export const GET = app.fetch;
export const POST = app.fetch; 