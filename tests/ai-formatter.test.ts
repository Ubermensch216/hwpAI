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
