import { z } from 'zod';
import Parser from 'rss-parser';
import { WebClient } from '@slack/web-api';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';

// RSSフィードのパーサー
const parser = new Parser();

// OpenAIクライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ポッドキャストエピソードのスキーマ
const PodcastSchema = z.object({
  title: z.string(),
  content: z.string(),
  link: z.string().url(),
  pubDate: z.string(),
});

// テキストを日本語に翻訳する関数
const translateToJapanese = async (text: string) => {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "あなたは優秀な翻訳者です。英語のテキストを自然な日本語に翻訳してください。"
      },
      {
        role: "user",
        content: `以下のテキストを日本語に翻訳してください：\n\n${text}`
      }
    ],
    temperature: 0.3,
  });

  return response.choices[0].message.content || text;
};

// ポッドキャスト情報を取得する関数
async function getPodcastInfo() {
  // Lex FridmanのポッドキャストRSSフィードを取得
  const feed = await parser.parseURL('https://lexfridman.com/feed/podcast/');
  
  // 最新のエピソードを取得
  const latestEpisode = PodcastSchema.parse(feed.items[0]);

  // タイトルとコンテンツを日本語に翻訳
  const [translatedTitle, translatedContent] = await Promise.all([
    translateToJapanese(latestEpisode.title),
    translateToJapanese(latestEpisode.content),
  ]);

  return {
    title: translatedTitle,
    content: translatedContent,
    link: latestEpisode.link,
    pubDate: latestEpisode.pubDate,
  };
}

export async function GET() {
  try {
    // 環境変数のチェック
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI APIキーが設定されていません');
    }

    const podcastInfo = await getPodcastInfo();
    return NextResponse.json({ success: true, data: podcastInfo });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: 'エラーが発生しました' }, { status: 500 });
  }
}

export async function POST() {
  try {
    // 環境変数のチェック
    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID || !process.env.OPENAI_API_KEY) {
      throw new Error('必要な環境変数が設定されていません');
    }

    const podcastInfo = await getPodcastInfo();

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
            text: `*${podcastInfo.title}*\n\n${podcastInfo.content}\n\n<${podcastInfo.link}|エピソードを聴く>`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `公開日: ${new Date(podcastInfo.pubDate).toLocaleDateString('ja-JP')}`
            }
          ]
        }
      ]
    });

    return NextResponse.json({ success: true, message: 'ポッドキャスト情報をSlackに送信しました' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: 'エラーが発生しました' }, { status: 500 });
  }
} 