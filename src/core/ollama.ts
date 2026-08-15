/**
 * 로컬 Ollama 및 OpenAI 호환 REST API 연동 클라이언트 (rhwp AI Assister 전용)
 * 
 * 기본 타겟: http://localhost:11434
 * 기본 모델: gemma4:e2b
 */

export interface OllamaModelInfo {
  name: string;
  modified_at: string;
  size: number;
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiGenerationMetrics {
  durationMs: number;
  evalCount: number;
  evalDurationMs?: number;
  tokPerSec?: number;
  cached?: boolean;
}

export interface OllamaGenerateOptions {
  model?: string;
  system?: string;
  temperature?: number;
  onToken?: (chunkText: string, fullText: string) => void;
  onDone?: (fullText: string, metrics: AiGenerationMetrics) => void;
}

export class OllamaClient {
  private baseUrl: string;
  private defaultModel: string;
  private apiKey: string = '';
  private isChatCompletions: boolean = false;

  constructor(
    baseUrl: string = 'http://localhost:11434',
    defaultModel: string = 'gemma4:e2b',
    apiKey: string = '',
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultModel = defaultModel;
    this.apiKey = apiKey;
    this.checkEndpointType();
  }

  private checkEndpointType() {
    this.isChatCompletions = this.baseUrl.endsWith('/v1') || this.baseUrl.includes('openai');
  }

  /** 현재 설정된 기본 모델 반환 */
  getModel(): string {
    return this.defaultModel;
  }

  /** 기본 모델 변경 */
  setModel(model: string): void {
    if (model && model.trim()) {
      this.defaultModel = model.trim();
    }
  }

  /** 현재 설정된 Base URL 반환 */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /** Base URL 변경 */
  setBaseUrl(url: string): void {
    if (url && url.trim()) {
      this.baseUrl = url.trim().replace(/\/$/, '');
      this.checkEndpointType();
    }
  }

  /** API Key 설정 */
  setApiKey(key: string): void {
    this.apiKey = (key || '').trim();
  }

  getApiKey(): string {
    return this.apiKey;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /** Ollama 서비스 헬스체크 및 모델 목록 조회 */
  async listModels(): Promise<OllamaModelInfo[]> {
    try {
      if (this.isChatCompletions) {
        const resp = await fetch(`${this.baseUrl}/models`, {
          headers: this.getHeaders(),
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        return (data.data || []).map((m: any) => ({
          name: m.id,
          modified_at: new Date().toISOString(),
          size: 0,
        }));
      }

      const resp = await fetch(`${this.baseUrl}/api/tags`, {
        headers: this.getHeaders(),
      });
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      const data = await resp.json();
      return data.models || [];
    } catch (err) {
      console.warn('[OllamaClient] Ollama 연결 실패:', err);
      return [];
    }
  }

  /** 특정 모델 존재 여부 확인 */
  async isModelAvailable(modelName: string = this.defaultModel): Promise<boolean> {
    const models = await this.listModels();
    return models.some(m => m.name === modelName || m.name.startsWith(`${modelName}:`));
  }

  /** 텍스트 생성 (스트리밍 지원) */
  async generate(prompt: string, options: OllamaGenerateOptions = {}): Promise<string> {
    const model = options.model || this.defaultModel;
    const system = options.system || '당신은 한글 HWPX 문서 편집을 도와주는 유능한 AI 어시스턴트입니다.';
    const temperature = options.temperature ?? 0.7;
    const startTime = performance.now();

    if (this.isChatCompletions) {
      return this.chat(
        [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        options,
      );
    }

    const payload = {
      model,
      prompt,
      system,
      options: { temperature },
      stream: true,
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Ollama API 오류: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('응답 스트림을 읽을 수 없습니다.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let buffer = '';
      let evalCount = 0;
      let evalDurationNs = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              fullText += parsed.response;
              if (options.onToken) {
                options.onToken(parsed.response, fullText);
              }
            }
            if (parsed.eval_count) evalCount = parsed.eval_count;
            if (parsed.eval_duration) evalDurationNs = parsed.eval_duration;
          } catch (e) {
            console.error('[OllamaClient] JSON 파싱 오류:', e, line);
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.response) {
            fullText += parsed.response;
            if (options.onToken) {
              options.onToken(parsed.response, fullText);
            }
          }
          if (parsed.eval_count) evalCount = parsed.eval_count;
          if (parsed.eval_duration) evalDurationNs = parsed.eval_duration;
        } catch {}
      }

      const durationMs = Math.round(performance.now() - startTime);
      const evalDurationMs = evalDurationNs ? Math.round(evalDurationNs / 1e6) : durationMs;
      const tokPerSec = evalCount > 0 && evalDurationMs > 0
        ? Math.round((evalCount / (evalDurationMs / 1000)) * 10) / 10
        : undefined;

      const metrics: AiGenerationMetrics = {
        durationMs,
        evalCount: evalCount || Math.round(fullText.length / 3),
        evalDurationMs,
        tokPerSec,
      };

      if (options.onDone) {
        options.onDone(fullText, metrics);
      }

      return fullText;
    } catch (err) {
      console.error('[OllamaClient] Generate 실패:', err);
      throw err;
    }
  }

  /** AI 대화 (Chat 모드) */
  async chat(messages: OllamaChatMessage[], options: OllamaGenerateOptions = {}): Promise<string> {
    const model = options.model || this.defaultModel;
    const startTime = performance.now();

    const url = this.isChatCompletions
      ? `${this.baseUrl}/chat/completions`
      : `${this.baseUrl}/api/chat`;

    const payload = this.isChatCompletions
      ? {
          model,
          messages,
          stream: true,
          temperature: options.temperature ?? 0.7,
        }
      : {
          model,
          messages,
          stream: true,
          options: { temperature: options.temperature ?? 0.7 },
        };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Ollama Chat API 오류: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('응답 스트림을 읽을 수 없습니다.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let buffer = '';
      let evalCount = 0;
      let evalDurationNs = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;

          // SSE format for OpenAI (data: {...})
          const jsonStr = cleanLine.startsWith('data:') ? cleanLine.slice(5).trim() : cleanLine;
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = parsed.message?.content || parsed.choices?.[0]?.delta?.content;
            if (chunk) {
              fullText += chunk;
              if (options.onToken) {
                options.onToken(chunk, fullText);
              }
            }
            if (parsed.eval_count) evalCount = parsed.eval_count;
            if (parsed.eval_duration) evalDurationNs = parsed.eval_duration;
            if (parsed.usage?.completion_tokens) evalCount = parsed.usage.completion_tokens;
          } catch (e) {
            // 무시
          }
        }
      }

      const durationMs = Math.round(performance.now() - startTime);
      const evalDurationMs = evalDurationNs ? Math.round(evalDurationNs / 1e6) : durationMs;
      const tokPerSec = evalCount > 0 && evalDurationMs > 0
        ? Math.round((evalCount / (evalDurationMs / 1000)) * 10) / 10
        : undefined;

      const metrics: AiGenerationMetrics = {
        durationMs,
        evalCount: evalCount || Math.round(fullText.length / 3),
        evalDurationMs,
        tokPerSec,
      };

      if (options.onDone) {
        options.onDone(fullText, metrics);
      }

      return fullText;
    } catch (err) {
      console.error('[OllamaClient] Chat 실패:', err);
      throw err;
    }
  }
}
