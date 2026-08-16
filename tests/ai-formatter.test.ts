import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseProofreadResponse,
  formatMarkdownToHtml,
  formatMarkdownToHwpText,
  replaceTextInHwp,
} from '../src/core/ai-formatter.ts';

test('parseProofreadResponse는 화살표 표기 교정 목록을 정확히 파싱한다', () => {
  const sample = `
1. 맞춤법이 틀린 문장 -> 맞춤법이 바른 문장 (띄어쓰기 오류)
2. 잘못된 어휘 -> 올바른 어휘 (문맥에 맞는 표준어 사용)
- "문서작성" -> "문서 작성" : 띄어쓰기 누락
  `;

  const items = parseProofreadResponse(sample);
  assert.equal(items.length, 3);
  assert.equal(items[0].original, '맞춤법이 틀린 문장');
  assert.equal(items[0].corrected, '맞춤법이 바른 문장');
  assert.equal(items[0].reason, '띄어쓰기 오류');

  assert.equal(items[1].original, '잘못된 어휘');
  assert.equal(items[1].corrected, '올바른 어휘');

  assert.equal(items[2].original, '문서작성');
  assert.equal(items[2].corrected, '문서 작성');
});

test('parseProofreadResponse는 빈 텍스트나 동일한 문장은 제외한다', () => {
  const sample = `
1. 동일한문장 -> 동일한문장 (변경 없음)
2. -> 빈 원본
  `;

  const items = parseProofreadResponse(sample);
  assert.equal(items.length, 0);
});

test('formatMarkdownToHwpText는 불필요한 마크다운 문법 기호를 HWP 친화적으로 정돈한다', () => {
  const md = `### 제목\n**강조된 텍스트** 및 *기울임*\n- 항목 1\n- 항목 2`;
  const result = formatMarkdownToHwpText(md);
  assert.ok(!result.includes('###'));
  assert.ok(!result.includes('**'));
  assert.ok(result.includes('제목'));
  assert.ok(result.includes('강조된 텍스트'));
});

test('formatMarkdownToHtml는 마크다운 표를 HTML 일반 테이블로 깔끔하게 변환한다', () => {
  const mdTable = `
| 항목 | 수량 | 단가 | 비고 |
| :--- | :---: | ---: | --- |
| 사과 | 10 | 1,000원 | 신선함 |
| 바나나 | 5 | 2,500원 | 유기농 |
  `.trim();

  const html = formatMarkdownToHtml(mdTable);

  assert.ok(html.includes('<table class="ai-table">'), 'ai-table 클래스를 가진 table 요소가 있어야 한다');
  assert.ok(html.includes('항목') && html.includes('수량') && html.includes('단가'));
  assert.ok(html.includes('사과') && html.includes('바나나'));
  assert.ok(html.includes('1,000원') && html.includes('2,500원'));
  assert.ok(html.includes('style="text-align:center;"'), '가운데 정렬 스타일이 적용되어야 한다');
  assert.ok(html.includes('style="text-align:right;"'), '우측 정렬 스타일이 적용되어야 한다');
  assert.ok(html.includes('<div class="ai-table-wrap">'), '가로 스크롤 wrap이 포함되어야 한다');
});

test('formatMarkdownToHtml는 불필요한 빈 행과 중복 개행을 제거하고 단정한 문단으로 변환한다', () => {
  const mdText = `
안녕하세요.

첫 번째 문단입니다.


두 번째 문단입니다.


- 항목 1
- 항목 2
  `.trim();

  const html = formatMarkdownToHtml(mdText);

  // 불필요하게 3개 이상의 <br/>이 들어가지 않아야 함
  assert.ok(!html.includes('<br/><br/><br/>'));
  // 문단 및 리스트가 정상 생성되어야 함
  assert.ok(html.includes('<p class="ai-p">'));
  assert.ok(html.includes('<ul class="ai-list">'));
  assert.ok(html.includes('<li class="ai-list-item">항목 1</li>'));
});

test('formatMarkdownToHtml는 인라인 볼드, 코드 및 헤더를 올바르게 렌더링한다', () => {
  const md = `## 요약 보고\n이것은 **중요한** 내용이며 \`const x = 10\` 코드가 포함됩니다.`;
  const html = formatMarkdownToHtml(md);

  assert.ok(html.includes('<h3 class="ai-h3">요약 보고</h3>'));
  assert.ok(html.includes('<strong>중요한</strong>'));
  assert.ok(html.includes('<code class="ai-inline-code">const x = 10</code>'));
});

test('replaceTextInHwp는 WASM 문서 내 대상 텍스트를 교체한다', () => {
  let text = '이 문서는 테스트용 오탈자가 포함되어 있습니다.';
  const mockWasm = {
    getDocumentInfo: () => ({ sectionCount: 1 }),
    getParagraphCount: () => 1,
    getParagraphLength: () => text.length,
    getTextRange: () => text,
    deleteText: (_sec: number, _para: number, offset: number, count: number) => {
      text = text.slice(0, offset) + text.slice(offset + count);
    },
    insertText: (_sec: number, _para: number, offset: number, newText: string) => {
      text = text.slice(0, offset) + newText + text.slice(offset);
    },
  };

  const res = replaceTextInHwp(mockWasm, '오탈자', '교정어');
  assert.equal(res, true);
  assert.equal(text, '이 문서는 테스트용 교정어가 포함되어 있습니다.');
});
