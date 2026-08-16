/**
 * AI 응답 텍스트 가독성 및 HWP 문맥 포맷팅 헬퍼
 */

/**
 * 인라인 마크다운 (볼드, 이탤릭, 인라인 코드, 링크, 취소선 등)을 HTML로 변환
 */
function formatInlineMarkdown(text: string): string {
  let res = text;
  // 볼드 + 이탤릭 (***텍스트*** or ___텍스트___)
  res = res.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // 볼드 (**텍스트** or __텍스트__)
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/__(.*?)__/g, '<strong>$1</strong>');
  // 이탤릭 (*텍스트* or _텍스트_)
  res = res.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  res = res.replace(/(?<!_)_(?!_)(.*?)(?<!_)_(?!_)/g, '<em>$1</em>');
  // 취소선 (~~텍스트~~)
  res = res.replace(/~~(.*?)~~/g, '<del>$1</del>');
  // 인라인 코드 (`코드`)
  res = res.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
  // 링크 ([텍스트](url))
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-link">$1</a>');
  return res;
}

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
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '$1');
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');
  text = text.replace(/_(.*?)_/g, '$1');
  text = text.replace(/~~(.*?)~~/g, '$1');

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
 * 마크다운 표 블록 라인들을 HTML <table> 요소로 변환한다.
 */
function renderMarkdownTableBlock(tableLines: string[]): string {
  if (tableLines.length < 2) return tableLines.join('\n');

  const parseRow = (line: string) => {
    let raw = line.trim();
    if (raw.startsWith('|')) raw = raw.slice(1);
    if (raw.endsWith('|')) raw = raw.slice(0, -1);
    return raw.split('|').map(c => c.trim());
  };

  const headerCells = parseRow(tableLines[0]);
  let alignments: ('left' | 'center' | 'right' | '')[] = [];
  let bodyStartIndex = 1;

  // 구분선 행 (|:---|:---:|---:|) 감지
  if (tableLines.length > 1 && /^\|?[\s\-:|]+\|?$/.test(tableLines[1].trim())) {
    const sepCells = parseRow(tableLines[1]);
    alignments = sepCells.map(cell => {
      const trimmed = cell.trim();
      const leftColon = trimmed.startsWith(':');
      const rightColon = trimmed.endsWith(':');
      if (leftColon && rightColon) return 'center';
      if (rightColon) return 'right';
      if (leftColon) return 'left';
      return '';
    });
    bodyStartIndex = 2;
  }

  const colCount = headerCells.length;
  if (colCount === 0) return tableLines.join('\n');

  let html = '<div class="ai-table-wrap"><table class="ai-table"><thead><tr>';
  headerCells.forEach((h, idx) => {
    const align = alignments[idx] ? ` style="text-align:${alignments[idx]};"` : '';
    html += `<th${align}>${formatInlineMarkdown(h)}</th>`;
  });
  html += '</tr></thead><tbody>';

  for (let i = bodyStartIndex; i < tableLines.length; i++) {
    const line = tableLines[i].trim();
    if (!line) continue;
    // 혹시 중간에 구분선이 또 나오면 건너뛰기
    if (/^\|?[\s\-:|]+\|?$/.test(line)) continue;

    const rowCells = parseRow(line);
    while (rowCells.length < colCount) rowCells.push('');

    html += '<tr>';
    for (let c = 0; c < colCount; c++) {
      const align = alignments[c] ? ` style="text-align:${alignments[c]};"` : '';
      const cellContent = formatInlineMarkdown(rowCells[c] || '');
      html += `<td${align}>${cellContent || '&nbsp;'}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

/**
 * 2. AI 대화 창(Chat UI)에서 읽기 쉽도록 마크다운을 깔끔한 HTML 스타일로 변환한다.
 * - 불필요한 빈 행/과도한 행간 공백 제거
 * - 마크다운 표(|...|)를 정교한 HTML 일반 테이블로 변환
 * - 코드블록, 헤더, 순서형/비순서형 목록, 인용문, 인라인 서식 지원
 */
export function formatMarkdownToHtml(markdownText: string): string {
  if (!markdownText) return '';

  // 1. HTML 특수문자 이스케이프 (코드 블록/인라인 코드 등 안전 보장)
  let text = markdownText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. 코드 블록 보호 (``` ... ```)
  const codeBlocks: string[] = [];
  text = text.replace(/```([a-zA-Z0-9_\-]*)?\n?([\s\S]*?)```/g, (_match, lang, code) => {
    const langClass = lang ? ` class="language-${lang.trim()}"` : '';
    const index = codeBlocks.length;
    codeBlocks.push(
      `<div class="ai-code-block-wrap"><div class="ai-code-header">${lang ? `<span>${lang}</span>` : ''}</div><pre class="ai-code-block"><code${langClass}>${code.trim()}</code></pre></div>`
    );
    return `@@CODE_BLOCK_${index}@@`;
  });

  // 3. 줄 단위 블록 파싱 (테이블, 목록, 헤더, 인용문, 일반 문단)
  const rawLines = text.split('\n');
  const blocks: string[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 코드 블록 플레이스홀더 단독 라인인 경우
    if (trimmed.startsWith('@@CODE_BLOCK_') && trimmed.endsWith('@@')) {
      blocks.push(trimmed);
      i++;
      continue;
    }

    // 빈 줄 건너뛰기
    if (!trimmed) {
      i++;
      continue;
    }

    // A. 마크다운 테이블 감지 (최소 | 로 시작하거나 | 로 끝나는 형태)
    if (trimmed.startsWith('|') && trimmed.includes('|', 1)) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('|')) {
        tableLines.push(rawLines[i].trim());
        i++;
      }
      blocks.push(renderMarkdownTableBlock(tableLines));
      continue;
    }

    // B. 헤더 (# 제목, ## 제목, ### 제목)
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = formatInlineMarkdown(headerMatch[2]);
      if (level === 1) {
        blocks.push(`<h2 class="ai-h2">${content}</h2>`);
      } else if (level === 2) {
        blocks.push(`<h3 class="ai-h3">${content}</h3>`);
      } else {
        blocks.push(`<h4 class="ai-h4">${content}</h4>`);
      }
      i++;
      continue;
    }

    // C. 비순서형 목록 (- 항목, * 항목)
    if (/^[\*\-]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < rawLines.length && /^[\*\-]\s+/.test(rawLines[i].trim())) {
        const itemText = rawLines[i].trim().replace(/^[\*\-]\s+/, '');
        listItems.push(`<li class="ai-list-item">${formatInlineMarkdown(itemText)}</li>`);
        i++;
      }
      blocks.push(`<ul class="ai-list">${listItems.join('')}</ul>`);
      continue;
    }

    // D. 순서형 목록 (1. 항목, 2. 항목)
    if (/^\d+[\.\)]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < rawLines.length && /^\d+[\.\)]\s+/.test(rawLines[i].trim())) {
        const itemText = rawLines[i].trim().replace(/^\d+[\.\)]\s+/, '');
        listItems.push(`<li class="ai-list-item">${formatInlineMarkdown(itemText)}</li>`);
        i++;
      }
      blocks.push(`<ol class="ai-list ai-list-ordered">${listItems.join('')}</ol>`);
      continue;
    }

    // E. 인용구 (> 문장)
    if (trimmed.startsWith('&gt;') || trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < rawLines.length && (rawLines[i].trim().startsWith('&gt;') || rawLines[i].trim().startsWith('>'))) {
        const qLine = rawLines[i].trim().replace(/^(&gt;|>)\s*/, '');
        quoteLines.push(formatInlineMarkdown(qLine));
        i++;
      }
      blocks.push(`<blockquote class="ai-blockquote">${quoteLines.join('<br/>')}</blockquote>`);
      continue;
    }

    // F. 수평선 (---, ***, ___)
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push('<hr class="ai-hr"/>');
      i++;
      continue;
    }

    // G. 일반 문단: 연속된 텍스트 라인을 하나의 깔끔한 문단으로 묶음
    const paraLines: string[] = [];
    while (
      i < rawLines.length &&
      rawLines[i].trim() &&
      !rawLines[i].trim().startsWith('|') &&
      !/^#{1,6}\s+/.test(rawLines[i].trim()) &&
      !/^[\*\-]\s+/.test(rawLines[i].trim()) &&
      !/^\d+[\.\)]\s+/.test(rawLines[i].trim()) &&
      !rawLines[i].trim().startsWith('&gt;') &&
      !rawLines[i].trim().startsWith('>') &&
      !/^(\-{3,}|\*{3,}|_{3,})$/.test(rawLines[i].trim()) &&
      !rawLines[i].trim().startsWith('@@CODE_BLOCK_')
    ) {
      paraLines.push(formatInlineMarkdown(rawLines[i].trim()));
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push(`<p class="ai-p">${paraLines.join('<br/>')}</p>`);
    }
  }

  // 4. 블록 결합 및 코드 블록 복원
  let finalHtml = blocks.join('\n');
  codeBlocks.forEach((codeHtml, idx) => {
    finalHtml = finalHtml.replace(`@@CODE_BLOCK_${idx}@@`, codeHtml);
  });

  return finalHtml;
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

/**
 * 5. 맞춤법 교정 항목 구조
 */
export interface ProofreadItem {
  id: string;
  original: string;
  corrected: string;
  reason: string;
}

/**
 * 6. LLM의 맞춤법 교정 응답 텍스트를 구조화된 항목 배열로 파싱한다.
 */
export function parseProofreadResponse(rawText: string): ProofreadItem[] {
  if (!rawText) return [];
  const lines = rawText.split('\n');
  const items: ProofreadItem[] = [];
  let itemCounter = 1;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 패턴 1: 1. 원본 -> 수정 (사유) or - 원본 -> 수정 (사유)
    const arrowMatch = line.match(/^(?:(?:\d+[\.\)]|\*|\-)\s*)?["'‘“]?(.*?)["'’”]?\s*(?:->|→|=>)\s*["'‘“]?(.*?)["'’”]?\s*(?:\((.*?)\)|사유[:：]\s*(.*?)|[:：]\s*(.*?))?$/);
    if (arrowMatch && arrowMatch[1] && arrowMatch[2]) {
      const orig = arrowMatch[1].replace(/^(?:원본[:：]?\s*)/, '').trim();
      const corr = arrowMatch[2].replace(/^(?:수정|교정)[:：]?\s*/, '').trim();
      const reason = (arrowMatch[3] || arrowMatch[4] || arrowMatch[5] || '맞춤법 및 문체 교정').trim();

      if (orig && corr && orig !== corr) {
        items.push({
          id: `proofread_${itemCounter++}`,
          original: orig,
          corrected: corr,
          reason,
        });
        continue;
      }
    }

    // 패턴 2: 원본: ... / 교정: ... (사유)
    const labelMatch = line.match(/원본[:：]\s*["'‘“]?(.*?)["'’”]?\s*[,/|]\s*(?:교정|수정)[:：]\s*["'‘“]?(.*?)["'’”]?\s*(?:\((.*?)\))?$/);
    if (labelMatch && labelMatch[1] && labelMatch[2]) {
      const orig = labelMatch[1].trim();
      const corr = labelMatch[2].trim();
      const reason = (labelMatch[3] || '맞춤법 및 문체 교정').trim();
      if (orig && corr && orig !== corr) {
        items.push({
          id: `proofread_${itemCounter++}`,
          original: orig,
          corrected: corr,
          reason,
        });
      }
    }
  }

  return items;
}

/**
 * 7. 문서 내에서 특정 텍스트(targetText)를 찾아 replacementText로 교체한다.
 */
export function replaceTextInHwp(hwpCtrlOrWasm: any, targetText: string, replacementText: string): boolean {
  if (!hwpCtrlOrWasm || !targetText) return false;
  const wasm = typeof hwpCtrlOrWasm.getWasmDoc === 'function' ? hwpCtrlOrWasm.getWasmDoc() : hwpCtrlOrWasm;
  if (!wasm || typeof wasm.getDocumentInfo !== 'function') return false;

  try {
    const info = wasm.getDocumentInfo();
    if (!info || typeof info.sectionCount !== 'number') return false;

    const trimmedTarget = targetText.trim();
    if (!trimmedTarget) return false;

    for (let sec = 0; sec < info.sectionCount; sec++) {
      const paraCount = wasm.getParagraphCount(sec);
      for (let para = 0; para < paraCount; para++) {
        const len = wasm.getParagraphLength(sec, para);
        if (len <= 0) continue;
        const pText = wasm.getTextRange(sec, para, 0, len);
        if (!pText) continue;

        const idx = pText.indexOf(trimmedTarget);
        if (idx !== -1) {
          wasm.deleteText(sec, para, idx, trimmedTarget.length);
          wasm.insertText(sec, para, idx, replacementText);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('rhwp-document-updated'));
          }
          return true;
        }
      }
    }
    return false;
  } catch (err) {
    console.error('[ai-formatter] replaceTextInHwp 실패:', err);
    return false;
  }
}
