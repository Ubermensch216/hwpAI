/**
 * 선택 영역 → 평문 텍스트 추출을 위한 순수 슬라이스 계산.
 *
 * AI Assister 가 "문서 전체" 대신 "사용자가 드래그한 부분"만 질의 맥락으로 쓰려면
 * 선택 범위를 문단 단위 (from, to) 구간 목록으로 펼쳐야 한다. WASM 클립보드를 거치는
 * copySelection 경로는 사용자의 복사 내용을 덮어쓰므로 쓰지 않고, 읽기 전용
 * getTextRange / getTextInCell 로 같은 범위를 다시 읽는다.
 *
 * 이 모듈은 wasm·커서 상태 없이 구간 계산만 담당해 단위 테스트가 가능하게 한다.
 */

/** 한 문단에서 읽어야 할 문자 구간 */
export interface TextSlice {
  sectionIndex: number;
  paragraphIndex: number;
  from: number;
  to: number;
}

/** 선택 범위의 양 끝점 (본문 기준) */
export interface SliceEndpoint {
  sectionIndex: number;
  paragraphIndex: number;
  charOffset: number;
}

/** 선택 텍스트가 잘렸음을 알리는 말줄임 표기 */
export const SELECTION_TRUNCATED_SUFFIX = '[...선택 영역이 길어 이하 생략됨...]';

/**
 * 본문(표 밖) 선택 범위를 문단별 구간으로 펼친다.
 *
 * 구역을 넘는 선택이면 시작 구역의 남은 문단 → 중간 구역 전체 → 끝 구역의 앞 문단 순으로 잇는다.
 * 문단 길이/개수 조회는 주입받아 이 함수 자체는 순수하게 유지한다.
 */
export function bodyTextSlices(
  start: SliceEndpoint,
  end: SliceEndpoint,
  paragraphCountAt: (sectionIndex: number) => number,
  paragraphLengthAt: (sectionIndex: number, paragraphIndex: number) => number,
): TextSlice[] {
  const slices: TextSlice[] = [];

  for (let sec = start.sectionIndex; sec <= end.sectionIndex; sec++) {
    const isFirstSec = sec === start.sectionIndex;
    const isLastSec = sec === end.sectionIndex;

    const firstPara = isFirstSec ? start.paragraphIndex : 0;
    const lastPara = isLastSec ? end.paragraphIndex : Math.max(paragraphCountAt(sec) - 1, 0);

    for (let para = firstPara; para <= lastPara; para++) {
      const paraLen = paragraphLengthAt(sec, para);
      const from = isFirstSec && para === start.paragraphIndex ? start.charOffset : 0;
      const to = isLastSec && para === end.paragraphIndex ? end.charOffset : paraLen;
      slices.push({
        sectionIndex: sec,
        paragraphIndex: para,
        from: clamp(from, 0, paraLen),
        to: clamp(to, 0, paraLen),
      });
    }
  }

  return slices.filter((s) => s.to > s.from);
}

/**
 * 한 셀 안에서의 선택 범위를 셀 문단별 구간으로 펼친다.
 *
 * 셀 좌표(sec/ppi/ci/cellIdx)는 호출자가 이미 알고 있으므로 여기서는 셀 문단 인덱스 축만 다룬다.
 */
export function cellTextSlices(
  startCellPara: number,
  startOffset: number,
  endCellPara: number,
  endOffset: number,
  cellParagraphLengthAt: (cellParaIndex: number) => number,
): { cellParaIndex: number; from: number; to: number }[] {
  const slices: { cellParaIndex: number; from: number; to: number }[] = [];

  for (let cp = startCellPara; cp <= endCellPara; cp++) {
    const paraLen = cellParagraphLengthAt(cp);
    const from = cp === startCellPara ? startOffset : 0;
    const to = cp === endCellPara ? endOffset : paraLen;
    slices.push({ cellParaIndex: cp, from: clamp(from, 0, paraLen), to: clamp(to, 0, paraLen) });
  }

  return slices.filter((s) => s.to > s.from);
}

/**
 * 문단별로 읽어온 텍스트 조각을 하나의 평문으로 합친다.
 *
 * maxChars 를 넘으면 그 지점에서 끊고 말줄임 표기를 붙인다 — 로컬 LLM 컨텍스트 창을
 * 넘기면 선택 영역 자체가 잘려 나가 오히려 엉뚱한 답이 나오기 때문이다.
 */
export function joinSelectionLines(lines: string[], maxChars: number): string {
  const kept: string[] = [];
  let total = 0;

  for (const line of lines) {
    if (total + line.length > maxChars) {
      const remaining = maxChars - total;
      if (remaining > 0) kept.push(line.slice(0, remaining));
      kept.push(SELECTION_TRUNCATED_SUFFIX);
      return kept.join('\n');
    }
    kept.push(line);
    total += line.length;
  }

  return kept.join('\n');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
