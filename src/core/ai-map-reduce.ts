/**
 * 대용량 문서 청킹 및 계층적 Map-Reduce 요약 엔진
 */
import type { OllamaClient } from './ollama';

export interface MapReduceOptions {
  chunkSize?: number;
  overlap?: number;
  temperature?: number;
  onProgress?: (
    stage: 'chunking' | 'mapping' | 'reducing' | 'done',
    percent: number,
    statusText: string,
  ) => void;
  onToken?: (chunkText: string, fullText: string) => void;
}

/**
 * 1. 문단 및 줄바꿈 경계를 고려하여 텍스트를 청크 단위로 분할한다.
 */
export function chunkText(
  text: string,
  chunkSize: number = 4000,
  overlap: number = 200,
): string[] {
  if (!text || text.length <= chunkSize) {
    return text ? [text] : [];
  }

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';

  for (const para of paragraphs) {
    const cleanPara = para.trim();
    if (!cleanPara) continue;

    if (currentChunk.length + cleanPara.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        // 오버랩: 이전 청크의 끝부분 일부를 다음 청크 서두로 유지
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = `${overlapText}\n\n${cleanPara}`;
      } else {
        // 단일 문단 자체가 chunkSize보다 큰 경우 글자 단위로 분할
        let start = 0;
        while (start < cleanPara.length) {
          chunks.push(cleanPara.slice(start, start + chunkSize));
          start += chunkSize - overlap;
        }
        currentChunk = '';
      }
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${cleanPara}` : cleanPara;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * 2. 계층적 Map-Reduce 요약 실행
 */
export async function summarizeWithMapReduce(
  fullDocumentText: string,
  ollamaClient: OllamaClient,
  options: MapReduceOptions = {},
): Promise<string> {
  const chunkSize = options.chunkSize ?? 4000;
  const overlap = options.overlap ?? 200;
  const temperature = options.temperature ?? 0.5;

  options.onProgress?.('chunking', 5, '문서 구조 분석 및 청크 분할 중...');

  const chunks = chunkText(fullDocumentText, chunkSize, overlap);

  // 단일 청크일 경우 일반 단일 요약 수행
  if (chunks.length <= 1) {
    options.onProgress?.('reducing', 50, 'AI 단일 패스 요약 분석 생성 중...');
    const prompt = `[현재 HWPX 문서 내용]\n${fullDocumentText}\n\n[요청사항]\n위 문서의 전체 요약, 주요 핵심 포인트(Bulleted list), 문서 톤앤매너 평가를 작성해주세요.`;
    return ollamaClient.generate(prompt, {
      temperature,
      onToken: options.onToken,
    });
  }

  // ── Step 1: Map Phase (각 청크별 핵심 요약 추출) ──
  const intermediateSummaries: string[] = [];
  const totalChunks = chunks.length;

  for (let i = 0; i < totalChunks; i++) {
    const chunkProgress = 10 + Math.round(((i + 1) / totalChunks) * 55); // 10% ~ 65%
    options.onProgress?.(
      'mapping',
      chunkProgress,
      `섹션 ${i + 1}/${totalChunks} 핵심 분석 중...`,
    );

    const mapPrompt = `[문서의 ${i + 1}/${totalChunks} 섹션 내용]\n${chunks[i]}\n\n[요청사항]\n위 섹션에서 다루는 주요 사실, 데이터, 핵심 쟁점만을 간결한 불렛포인트(•) 3~5개로 요약해 주세요.`;

    const sectionSummary = await ollamaClient.generate(mapPrompt, {
      temperature: 0.3,
    });
    intermediateSummaries.push(`[섹션 ${i + 1} 요약]\n${sectionSummary.trim()}`);
  }

  // ── Step 2: Reduce Phase (모든 섹션 요약을 통합 종합 리포트 생성) ──
  options.onProgress?.('reducing', 75, '섹션별 요약을 통합 종합 리포트로 합성 중...');

  const combinedIntermediate = intermediateSummaries.join('\n\n');
  const reducePrompt = `[문서 전체의 섹션별 핵심 요약 모음]\n${combinedIntermediate}\n\n[요청사항]\n위 섹션별 요약을 종합 분석하여 다음 구성으로 종합 리포트를 작성해 주세요:\n1. 📌 총괄 요약 (Executive Summary: 3~4문장)\n2. 🔑 핵심 쟁점 및 주요 내용 (체계적인 불렛포인트)\n3. 📊 시사점 및 결론`;

  const finalReport = await ollamaClient.generate(reducePrompt, {
    temperature,
    onToken: options.onToken,
  });

  options.onProgress?.('done', 100, '대용량 문서 종합 요약 완료');
  return finalReport;
}
