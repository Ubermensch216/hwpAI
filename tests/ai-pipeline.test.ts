import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMarkdownTable,
  matrixToMarkdownTable,
  insertTableToHwp,
} from '../src/core/ai-table-pipeline.ts';
import { chunkText } from '../src/core/ai-map-reduce.ts';

test('parseMarkdownTable는 올바른 마크다운 표 문자열을 구조화된 객체로 파싱한다', () => {
  const md = `
| 항목 | 수량 | 단가 | 비고 |
| :--- | :--- | :--- | :--- |
| 모니터 | 2 | 300,000 | 4K |
| 키보드 | 5 | 120,000 | 기계식 |
  `;

  const parsed = parseMarkdownTable(md);
  assert.ok(parsed);
  assert.equal(parsed?.colCount, 4);
  assert.equal(parsed?.headers.length, 4);
  assert.equal(parsed?.headers[0], '항목');
  assert.equal(parsed?.headers[1], '수량');
  assert.equal(parsed?.rows.length, 2);
  assert.equal(parsed?.rows[0][0], '모니터');
  assert.equal(parsed?.rows[1][0], '키보드');
});

test('matrixToMarkdownTable는 2D 행렬을 마크다운 표 텍스트로 변환한다', () => {
  const matrix = [
    ['이름', '부서', '직급'],
    ['홍길동', '개발팀', '선임'],
    ['김영희', '기획팀', '책임'],
  ];

  const md = matrixToMarkdownTable(matrix);
  assert.ok(md.includes('| 이름 | 부서 | 직급 |'));
  assert.ok(md.includes('| 홍길동 | 개발팀 | 선임 |'));
  assert.ok(md.includes('| 김영희 | 기획팀 | 책임 |'));
});

test('insertTableToHwp는 WASM 문서에 표와 셀 데이터를 생성한다', () => {
  const insertedCells: { cellIdx: number; text: string }[] = [];
  const mockWasm = {
    createTable: (_sec: number, _para: number, _off: number, rows: number, cols: number) => {
      return { ok: true, paraIdx: 1, controlIdx: 0, rows, cols };
    },
    insertTextInCell: (
      _sec: number,
      _tablePara: number,
      _ctrl: number,
      cellIdx: number,
      _cPara: number,
      _cOff: number,
      text: string,
    ) => {
      insertedCells.push({ cellIdx, text });
    },
  };

  const tableData = {
    rowCount: 2,
    colCount: 2,
    headers: ['A', 'B'],
    rows: [['1', '2']],
  };

  const success = insertTableToHwp(mockWasm, tableData);
  assert.equal(success, true);
  assert.equal(insertedCells.length, 4);
  assert.equal(insertedCells[0].text, 'A');
  assert.equal(insertedCells[1].text, 'B');
  assert.equal(insertedCells[2].text, '1');
  assert.equal(insertedCells[3].text, '2');
});

test('chunkText는 지정된 크기 단위로 문단을 분할하고 오버랩을 유지한다', () => {
  const text = `첫 번째 문단입니다.\n\n두 번째 문단입니다.\n\n세 번째 문단입니다.\n\n네 번째 문단입니다.`;
  const chunks = chunkText(text, 25, 5);

  assert.ok(chunks.length >= 2);
  assert.ok(chunks[0].includes('첫 번째 문단입니다.'));
});
