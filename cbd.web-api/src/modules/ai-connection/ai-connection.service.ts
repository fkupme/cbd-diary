import { Injectable, Logger } from '@nestjs/common';

interface ChatMessagePayload {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GenerateOpts {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * Бюджет «размышлений» Gemini 2.5 (в токенах). 0 — отключить (минимальная
   * задержка и цена, дефолт для чата). ВАЖНО: размышления тратят
   * maxOutputTokens — с дефолтным лимитом чата (700) включённый thinking
   * может съесть весь бюджет и вернуть пустой текст (проверено на 2.5-pro).
   */
  thinkingBudget?: number;
  /** Строгий JSON-выход (responseMimeType: application/json) */
  responseJson?: boolean;
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiRequestBody {
  systemInstruction?: { parts: { text: string }[] };
  contents: GeminiContent[];
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    thinkingConfig?: { thinkingBudget: number };
    responseMimeType?: string;
  };
}

@Injectable()
export class AiConnectionService {
  private readonly logger = new Logger(AiConnectionService.name);

  private get apiKey(): string {
    return process.env.GEMINI_API_KEY || '';
  }

  private get baseUrl(): string {
    return (
      process.env.GEMINI_API_URL ||
      'https://generativelanguage.googleapis.com/v1beta'
    );
  }

  private get defaultModel(): string {
    // Стабильная 2.5 flash: preview-версии текстовой 2.5 flash сняты после GA
    return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  private get defaultThinkingBudget(): number {
    const raw = Number(process.env.GEMINI_THINKING_BUDGET);
    return Number.isFinite(raw) ? raw : 0;
  }

  // system-сообщения уходят в systemInstruction, assistant -> model
  private buildRequestBody(
    messages: ChatMessagePayload[],
    opts?: GenerateOpts,
  ): GeminiRequestBody {
    const systemText = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const contents: GeminiContent[] = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.content }],
      }));

    // Gemini требует непустой contents: если истории нет — даём пустую реплику
    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: '' }] });
    }

    const body: GeminiRequestBody = {
      contents,
      generationConfig: {
        temperature:
          typeof opts?.temperature === 'number' ? opts.temperature : 0.7,
        maxOutputTokens:
          typeof opts?.maxTokens === 'number' ? opts.maxTokens : 512,
        thinkingConfig: {
          thinkingBudget:
            typeof opts?.thinkingBudget === 'number'
              ? opts.thinkingBudget
              : this.defaultThinkingBudget,
        },
      },
    };
    if (opts?.responseJson) {
      body.generationConfig.responseMimeType = 'application/json';
    }
    if (systemText) {
      body.systemInstruction = { parts: [{ text: systemText }] };
    }
    return body;
  }

  private async fetchWithRetry(
    url: string,
    body: GeminiRequestBody,
  ): Promise<Response> {
    // Повторы на перегрузку/лимиты (429/503) — у Gemini это штатные
    // транзиентные ответы (в пики 503 прилетают сериями).
    const MAX_ATTEMPTS = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(body),
        });
        if (
          (res.status === 429 || res.status === 503) &&
          attempt < MAX_ATTEMPTS - 1
        ) {
          const delayMs = 3000 * (attempt + 1);
          this.logger.warn(`Gemini: ${res.status}, повтор через ${delayMs}мс...`);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        return res;
      } catch (e) {
        lastError = e;
        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
      }
    }
    throw lastError ?? new Error('Gemini: запрос не удался');
  }

  private extractText(data: any): string {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts
      .filter((p: any) => typeof p?.text === 'string' && !p?.thought)
      .map((p: any) => p.text)
      .join('');
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
    opts?: GenerateOpts,
  ): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set');
      return '';
    }
    const model = opts?.model || this.defaultModel;
    const body = this.buildRequestBody(messages, opts);
    try {
      this.logger.log(
        `Gemini: model=${model}, temp=${body.generationConfig.temperature}, maxTokens=${body.generationConfig.maxOutputTokens}`,
      );
      const res = await this.fetchWithRetry(
        `${this.baseUrl}/models/${model}:generateContent`,
        body,
      );
      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
        return '';
      }
      const data = await res.json();
      const text = this.extractText(data);
      const finish = data?.candidates?.[0]?.finishReason;
      if (!text && finish === 'MAX_TOKENS') {
        this.logger.warn(
          'Gemini: пустой ответ из-за MAX_TOKENS — размышления съели бюджет, увеличьте maxTokens или уменьшите thinkingBudget',
        );
      }
      this.logger.log(`Gemini: ответ получен, длина=${text.length}`);
      return text;
    } catch (e: any) {
      this.logger.error(`Gemini request failed: ${e?.message || e}`);
      return '';
    }
  }

  async generateTextStream(
    messages: ChatMessagePayload[],
    onDelta: (delta: string) => Promise<void> | void,
    opts?: GenerateOpts,
  ): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set');
      return '';
    }
    const model = opts?.model || this.defaultModel;
    const body = this.buildRequestBody(messages, opts);

    let full = '';
    try {
      this.logger.log(
        `Gemini(stream): model=${model}, temp=${body.generationConfig.temperature}, maxTokens=${body.generationConfig.maxOutputTokens}`,
      );
      const res = await this.fetchWithRetry(
        `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse`,
        body,
      );
      if (!res.ok || !res.body) {
        const errText = await res.text();
        this.logger.error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
        return '';
      }

      // SSE: события вида "data: {json}\n\n"
      const decoder = new TextDecoder();
      let buffer = '';
      for await (const chunk of res.body as any) {
        buffer += decoder.decode(chunk, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice('data:'.length).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const data = JSON.parse(payload);
            const delta = this.extractText(data);
            if (delta) {
              full += delta;
              await onDelta(delta);
            }
          } catch {
            // неполный JSON в середине чанка не ожидается при построчном SSE,
            // но на всякий случай не роняем стрим
          }
        }
      }
      this.logger.log(`Gemini(stream): done, total length=${full.length}`);
      return full;
    } catch (e: any) {
      this.logger.error(`Gemini stream failed: ${e?.message || e}`);
      return full;
    }
  }

  /**
   * Расшифровка голосовой заметки в текст мультимодальным Gemini (inline base64).
   * Для коротких заметок (до ~1 мин) inline-данных достаточно; длинные стоит
   * слать через Files API (не реализовано). temperature=0 — дословно, без фантазий.
   */
  async transcribeAudio(
    audioBase64: string,
    mimeType: string,
    opts?: { model?: string; instruction?: string; maxTokens?: number },
  ): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set');
      return '';
    }
    const model = opts?.model || this.defaultModel;
    const instruction =
      opts?.instruction ||
      'Расшифруй это голосовое сообщение дословно, на языке оригинала. ' +
        'Верни ТОЛЬКО текст расшифровки — без кавычек, пояснений, таймкодов и эмодзи. ' +
        'Сохраняй разговорную речь как есть, включая нецензурные слова. ' +
        'Если речи нет — верни пустую строку.';
    const body: GeminiRequestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: instruction },
            { inlineData: { mimeType, data: audioBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens:
          typeof opts?.maxTokens === 'number' ? opts.maxTokens : 2048,
        thinkingConfig: { thinkingBudget: 0 },
      },
    };
    try {
      const approxBytes = Math.round((audioBase64.length * 3) / 4);
      this.logger.log(
        `Gemini(transcribe): model=${model}, mime=${mimeType}, ~${approxBytes}B`,
      );
      const res = await this.fetchWithRetry(
        `${this.baseUrl}/models/${model}:generateContent`,
        body,
      );
      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(
          `Gemini transcribe ${res.status}: ${errText.slice(0, 300)}`,
        );
        return '';
      }
      const data = await res.json();
      const text = this.extractText(data).trim();
      this.logger.log(`Gemini(transcribe): длина=${text.length}`);
      return text;
    } catch (e: any) {
      this.logger.error(`Gemini transcribe failed: ${e?.message || e}`);
      return '';
    }
  }

  async generateAiReply(userId: string, chatId: string, userMessage: string) {
    this.logger.log(
      `AI REPLY STUB for chat ${chatId}, user ${userId}: ${userMessage}`,
    );
    return { ok: true } as any;
  }
}
