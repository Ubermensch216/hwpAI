/**
 * AI 응답 텍스트 가독성 및 HWP 문맥 포맷팅 헬퍼
 */

/**
 * 1. 마크다운 특수문자를 제거하고 일반 한글 문서에 어울리는 깔끔한 텍스트로 정제한다.
 */
export function formatMarkdownToHwpText(markdownText: string): string {
  if (!markdownText) return '';

  let text = markdownText;

  // 코드 블록 라인 제거 (```markdown ... ```)
  text = text.replace(/^```[a-z]*\n?/gim, '').replace(/\n?```$/gim, '');

  // 헤딩 (# 제목 -> [제목])
  text = text.replace(/^#{1,6}\s*(.+)$/gm, '$1');

  // 볼드/이탤릭 (**텍스트**, *텍스트*, __텍스트__) -> 텍스트
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');
  text = text.replace(/_(.*?)_/g, '$1');

  // 인라인 코드 (`코드` -> 코드)
  text = text.replace(/`(.*?)`/g, '$1');

  // 링크 ([텍스트](url) -> 텍스트)
  text = text.replace(/\[(.*?)\]\((.*?)\)/g, '$1');

  // 리스트 항목 (- 항목, * 항목 -> • 항목)
  text = text.replace(/^[\*\-]\s+(.+)$/gm, '• $1');

  // 인용구 (> 문장 -> 문장)
  text = text.replace(/^>\s+(.+)$/gm, '$1');

  // 연속 3개 이상의 줄바꿈을 2개로 정돈
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * 2. AI 대화 창(Chat UI)에서 읽기 쉽도록 마크다운을 깔끔한 HTML 스타일로 변환한다.
 */
export function formatMarkdownToHtml(markdownText: string): string {
  if (!markdownText) return '';

  let html = markdownText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 코드 블록
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="ai-code-block"><code>$1</code></pre>');

  // 헤더 (# 제목)
  html = html.replace(/^### (.*$)/gim, '<h4 class="ai-h4">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="ai-h3">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="ai-h2">$1</h2>');

  // 볼드 (**텍스트**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 인라인 코드 (`코드`)
  html = html.replace(/`(.*?)`/g, '<code class="ai-inline-code">$1</code>');

  // 리스트 항목 (- 또는 * )
  html = html.replace(/^[\*\-]\s+(.*$)/gim, '<li class="ai-list-item">$1</li>');
  html = html.replace(/(<li class="ai-list-item">.*<\/li>\n?)+/g, '<ul class="ai-list">$&</ul>');

  // 줄바꿈 처리 (\n -> <br/>)
  html = html.replace(/\n/g, '<br/>');

  // 연속 <br/> 정리
  html = html.replace(/(<br\/>){3,}/g, '<br/><br/>');

  return html;
}

/**
 * 3. HWP 에디터에 텍스트를 가독성 높게 (줄바꿈/문단 단위로 분할하여) 정교하게 삽입한다.
 */
export function insertFormattedTextToHwp(hwpCtrl: any, rawMarkdownText: string): boolean {
  if (!hwpCtrl) return false;

  const cleanText = formatMarkdownToHwpText(rawMarkdownText);
  if (!cleanText) return false;

  try {
    // 줄 단위로 분할하여 삽입
    const lines = cleanText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().length > 0) {
        hwpCtrl.InsertText(line);
      }
      // 다음 줄이 있으면 줄바꿈/문단 구분 적용
      if (i < lines.length - 1) {
        // HwpCtrl Run 'BreakPara' 또는 엔터 문자 삽입
        const runSuccess = hwpCtrl.Run('BreakPara');
        if (!runSuccess) {
          hwpCtrl.InsertText('\n');
        }
      }
    }
    return true;
  } catch (err) {
    console.error('[ai-formatter] HWP 삽입 실패, 폴백 삽입:', err);
    return hwpCtrl.InsertText(cleanText);
  }
}

/**
 * 4. 현재 HWP 에디터에 로드된 전체 문서의 텍스트를 파싱하여 추출한다.
 */
export function getFullDocumentText(hwpCtrlOrWasm: any, maxChars: number = 8000): string {
  if (!hwpCtrlOrWasm) return '';

  // HwpCtrl 인스턴스이면 내부 wasmDoc 추출
  const wasm = typeof hwpCtrlOrWasm.getWasmDoc === 'function' ? hwpCtrlOrWasm.getWasmDoc() : hwpCtrlOrWasm;
  if (!wasm || typeof wasm.getDocumentInfo !== 'function') return '';

  try {
    const info = wasm.getDocumentInfo();
    if (!info || typeof info.sectionCount !== 'number') return '';

    const textLines: string[] = [];
    let currentLength = 0;

    for (let sec = 0; sec < info.sectionCount; sec++) {
      const paraCount = wasm.getParagraphCount(sec);
      for (let para = 0; para < paraCount; para++) {
        const len = wasm.getParagraphLength(sec, para);
        if (len > 0) {
          const pText = wasm.getTextRange(sec, para, 0, len);
          if (pText && pText.trim()) {
            textLines.push(pText.trim());
            currentLength += pText.length;

            if (currentLength >= maxChars) {
              textLines.push('\n[...문서 내용이 길어 이하 생략됨...]');
              break;
            }
          }
        }
      }
      if (currentLength >= maxChars) break;
    }

    return textLines.join('\n');
  } catch (e) {
    console.warn('[ai-formatter] getFullDocumentText 예외:', e);
    return '';
  }
}
