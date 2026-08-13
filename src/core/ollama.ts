/**
 * 로컬 Ollama REST API 연동 클라이언트 (rhwp AI Assister 전용)
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

export interface OllamaGenerateOptions {
  model?: string;
  system?: string;
  temperature?: number;
  onToken?: (chunkText: string, fullText: string) => void;
}

export class OllamaClient {
  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl: string = 'http://localhost:11434', defaultModel: string = 'gemma4:e2b') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultModel = defaultModel;
  }

  /** Ollama 서비스 헬스체크 및 모델 목록 조회 */
  async listModels(): Promise<OllamaModelInfo[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/tags`);
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
        headers: { 'Content-Type': 'application/json' },
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 남은 미완성 줄 보관

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
          } catch (e) {
            console.error('[OllamaClient] JSON 파싱 오류:', e, line);
          }
        }
      }

      // buffer에 남은 내용 처리
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.response) {
            fullText += parsed.response;
            if (options.onToken) {
              options.onToken(parsed.response, fullText);
            }
          }
        } catch (e) {
          // 무시
        }
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
    const payload = {
      model,
      messages,
      stream: true,
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            if (parsed.message?.content) {
              const chunk = parsed.message.content;
              fullText += chunk;
              if (options.onToken) {
                options.onToken(chunk, fullText);
              }
            }
          } catch (e) {
            // 무시
          }
        }
      }

      return fullText;
    } catch (err) {
      console.error('[OllamaClient] Chat 실패:', err);
      throw err;
    }
  }
}
