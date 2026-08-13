import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bodyTextSlices,
  cellTextSlices,
  joinSelectionLines,
  SELECTION_TRUNCATED_SUFFIX,
} from '../src/core/selection-text.ts';

// AI Assister 가 "문서 전체" 대신 드래그한 범위만 질의 맥락으로 쓰려면, 선택 범위를
// 문단별 (from, to) 로 정확히 펼쳐야 한다. 한 글자라도 어긋나면 사용자가 고른 것과
// 다른 텍스트가 LLM 으로 넘어가고, 그건 화면상 티가 나지 않는 조용한 오답이 된다.

/** 모든 문단이 같은 길이인 단순 문서 */
const uniformDoc = (paraCount: number, paraLen: number) => ({
  paragraphCountAt: () => paraCount,
  paragraphLengthAt: () => paraLen,
});

test('한 문단 안의 선택은 그 구간 하나만 만든다', () => {
  const doc = uniformDoc(5, 100);
  const slices = bodyTextSlices(
    { sectionIndex: 0, paragraphIndex: 2, charOffset: 10 },
    { sectionIndex: 0, paragraphIndex: 2, charOffset: 35 },
    doc.paragraphCountAt,
    doc.paragraphLengthAt,
  );

  assert.deepEqual(slices, [{ sectionIndex: 0, paragraphIndex: 2, from: 10, to: 35 }]);
});

test('여러 문단에 걸친 선택은 첫/끝 문단만 부분, 사이 문단은 전체를 담는다', () => {
  const doc = uniformDoc(5, 40);
  const slices = bodyTextSlices(
    { sectionIndex: 0, paragraphIndex: 1, charOffset: 30 },
    { sectionIndex: 0, paragraphIndex: 3, charOffset: 7 },
    doc.paragraphCountAt,
    doc.paragraphLengthAt,
  );

  assert.deepEqual(slices, [
    { sectionIndex: 0, paragraphIndex: 1, from: 30, to: 40 },
    { sectionIndex: 0, paragraphIndex: 2, from: 0, to: 40 },
    { sectionIndex: 0, paragraphIndex: 3, from: 0, to: 7 },
  ]);
});

test('구역을 넘는 선택은 중간 구역 문단을 모두 포함한다', () => {
  const paraCounts = [3, 2, 4];
  const slices = bodyTextSlices(
    { sectionIndex: 0, paragraphIndex: 2, charOffset: 5 },
    { sectionIndex: 2, paragraphIndex: 1, charOffset: 3 },
    (sec) => paraCounts[sec],
    () => 20,
  );

  assert.deepEqual(slices.map((s) => [s.sectionIndex, s.paragraphIndex, s.from, s.to]), [
    [0, 2, 5, 20],
    [1, 0, 0, 20],
    [1, 1, 0, 20],
    [2, 0, 0, 20],
    [2, 1, 0, 3],
  ]);
});

test('빈 문단과 길이 0 구간은 결과에서 빠진다', () => {
  // 문단 1이 빈 문단(길이 0)인 문서 — 빈 줄을 넘겨봐야 LLM 컨텍스트만 낭비된다.
  const lengths = [10, 0, 10];
  const slices = bodyTextSlices(
    { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 },
    { sectionIndex: 0, paragraphIndex: 2, charOffset: 4 },
    () => 3,
    (_sec, para) => lengths[para],
  );

  assert.deepEqual(slices.map((s) => s.paragraphIndex), [0, 2]);
});

test('문단 길이를 넘는 offset 은 문단 끝으로 잘린다', () => {
  // 문서가 편집돼 커서 offset 이 실제 길이를 앞서는 경합 상황에서도 wasm 호출이
  // 범위 밖 count 를 받지 않아야 한다.
  const slices = bodyTextSlices(
    { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 },
    { sectionIndex: 0, paragraphIndex: 0, charOffset: 999 },
    () => 1,
    () => 12,
  );

  assert.deepEqual(slices, [{ sectionIndex: 0, paragraphIndex: 0, from: 0, to: 12 }]);
});

test('셀 안 선택은 셀 문단 인덱스 축으로 펼쳐진다', () => {
  const slices = cellTextSlices(0, 4, 2, 6, () => 15);

  assert.deepEqual(slices, [
    { cellParaIndex: 0, from: 4, to: 15 },
    { cellParaIndex: 1, from: 0, to: 15 },
    { cellParaIndex: 2, from: 0, to: 6 },
  ]);
});

test('셀 안 한 문단 선택은 구간 하나만 만든다', () => {
  assert.deepEqual(cellTextSlices(1, 2, 1, 9, () => 20), [
    { cellParaIndex: 1, from: 2, to: 9 },
  ]);
});

test('줄 합치기는 개행으로 잇고 maxChars 안이면 그대로 둔다', () => {
  const joined = joinSelectionLines(['가나다', '라마바'], 100);
  assert.equal(joined, '가나다\n라마바');
});

test('maxChars 를 넘으면 그 지점에서 끊고 생략 표기를 붙인다', () => {
  const joined = joinSelectionLines(['12345', '67890'], 8);

  assert.equal(joined, ['12345', '678', SELECTION_TRUNCATED_SUFFIX].join('\n'));
  assert.ok(joined.includes('생략됨'));
});

test('첫 줄부터 한도를 넘으면 잘린 조각과 생략 표기만 남는다', () => {
  const joined = joinSelectionLines(['abcdefghij'], 4);
  assert.equal(joined, ['abcd', SELECTION_TRUNCATED_SUFFIX].join('\n'));
});
