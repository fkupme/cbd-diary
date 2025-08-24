import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

interface ChatMessagePayload {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AiConnectionService {
  private readonly logger = new Logger(AiConnectionService.name);
  private client: OpenAI | null = null;

  constructor() {}

  private getClient(): OpenAI {
    if (this.client) return this.client;
    const apiKey = process.env.OPEN_ROUTER_API_KEY;
    const baseURL =
      process.env.OPEN_ROUTER_URL || 'https://openrouter.ai/api/v1';
    const referer =
      process.env.APP_URL || process.env.APP_BASE_URL || 'http://localhost';
    const title = process.env.APP_NAME || 'CBD Diary API';
    this.client = new OpenAI({
      apiKey: apiKey || '',
      baseURL,
      defaultHeaders: {
        'HTTP-Referer': referer,
        'X-Title': title,
      },
    });
    return this.client;
  }

  async logPrompt(
    userId: string,
    chatId: string,
    prompt: string,
  ): Promise<void> {
    this.logger.log(`AI PROMPT for chat ${chatId}, user ${userId}:\n${prompt}`);
  }

  async generateText(
    messages: ChatMessagePayload[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<string> {
    const apiKey = process.env.OPEN_ROUTER_API_KEY;
    if (!apiKey) {
      this.logger.warn('OPEN_ROUTER_API_KEY is not set');
      return '';
    }
    const client = this.getClient();
    const model =
      opts?.model || process.env.OPEN_ROUTER_MODEL;
    const temperature =
      typeof opts?.temperature === 'number' ? opts!.temperature : 0.7;
    const max_tokens =
      typeof opts?.maxTokens === 'number' ? opts!.maxTokens : 512;
    try {
      this.logger.log(
        `OpenRouter: calling model=${model}, temperature=${temperature}, max_tokens=${max_tokens}`,
      );
      const completion = await client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens,
      } as any);
      const text = completion?.choices?.[0]?.message?.content ?? '';
      this.logger.log(
        `OpenRouter: response received, length=${(text || '').length}`,
      );
      return text;
    } catch (e: any) {
      this.logger.error(`OpenRouter request failed: ${e?.message || e}`);
      return '';
    }
  }

  async generateTextStream(
    messages: ChatMessagePayload[],
    onDelta: (delta: string) => Promise<void> | void,
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<string> {
    const apiKey =
      process.env.OPEN_ROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      this.logger.warn('OPEN_ROUTER_API_KEY is not set');
      return '';
    }
    const client = this.getClient();
    const model =
      opts?.model ||
      process.env.OPEN_ROUTER_MODEL
      
    const temperature =
      typeof opts?.temperature === 'number' ? opts!.temperature : 0.7;
    const max_tokens =
      typeof opts?.maxTokens === 'number' ? opts!.maxTokens : 512;

    let full = '';
    try {
      this.logger.log(
        `OpenRouter(stream): calling model=${model}, temperature=${temperature}, max_tokens=${max_tokens}`,
      );
      const stream = await client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens,
        stream: true,
      } as any);

      for await (const chunk of stream as any) {
        const delta = chunk?.choices?.[0]?.delta?.content ?? '';
        if (typeof delta === 'string' && delta.length > 0) {
          full += delta;
          await onDelta(delta);
        }
      }
      this.logger.log(`OpenRouter(stream): done, total length=${full.length}`);
      return full;
    } catch (e: any) {
      this.logger.error(`OpenRouter stream failed: ${e?.message || e}`);
      return full;
    }
  }

  async generateAiReply(userId: string, chatId: string, userMessage: string) {
    this.logger.log(
      `AI REPLY STUB for chat ${chatId}, user ${userId}: ${userMessage}`,
    );
    return { ok: true } as any;
  }
}
