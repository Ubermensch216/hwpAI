/**
 * AI 표(Table) 데이터 추출, 변환, 자동 생성 파이프라인
 */

export interface ExtractedTable {
  tableIndex: number;
  paraIndex: number;
  rowCount: number;
  colCount: number;
  matrix: string[][];
  markdown: string;
}

export interface ParsedTableData {
  rowCount: number;
  colCount: number;
  headers: string[];
  rows: string[][];
}

/**
 * 1. 마크다운 표 텍스트 파싱
 */
export function parseMarkdownTable(markdownText: string): ParsedTableData | null {
  if (!markdownText) return null;

  const lines = markdownText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && l.endsWith('|'));

  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .slice(1, -1)
      .split('|')
      .map(c => c.trim());

  const headers = parseRow(lines[0]);
  const colCount = headers.length;
  if (colCount === 0) return null;

  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // 구분선 행 (|---|---|) 건너뛰기
    if (/^\|[\s\-:|]+\|$/.test(line)) continue;

    const cells = parseRow(line);
    while (cells.length < colCount) cells.push('');
    rows.push(cells.slice(0, colCount));
  }

  const rowCount = (rows.length > 0 ? rows.length : 0) + 1; // 헤더 포함

  return {
    rowCount,
    colCount,
    headers,
    rows,
  };
}

/**
 * 2. 2D 매트릭스 데이터를 마크다운 표 문자열로 변환
 */
export function matrixToMarkdownTable(matrix: string[][]): string {
  if (!matrix || matrix.length === 0 || !matrix[0]) return '';

  const colCount = Math.max(...matrix.map(r => r.length));
  const normalized = matrix.map(row => {
    const r = [...row];
    while (r.length < colCount) r.push('');
    return r;
  });

  const header = `| ${normalized[0].join(' | ')} |`;
  const sep = `| ${Array(colCount).fill('---').join(' | ')} |`;
  const body = normalized.slice(1).map(r => `| ${r.join(' | ')} |`).join('\n');

  return body ? `${header}\n${sep}\n${body}` : `${header}\n${sep}`;
}

/**
 * 3. HWP 에디터에 표를 생성하고 데이터를 채워 넣는다
 */
export function insertTableToHwp(
  hwpCtrlOrWasm: any,
  tableData: ParsedTableData,
): boolean {
  if (!hwpCtrlOrWasm || !tableData) return false;

  const wasm = typeof hwpCtrlOrWasm.getWasmDoc === 'function' ? hwpCtrlOrWasm.getWasmDoc() : hwpCtrlOrWasm;
  if (!wasm) return false;

  try {
    const cursor = typeof hwpCtrlOrWasm.getCursor === 'function'
      ? hwpCtrlOrWasm.getCursor()
      : { section: 0, para: 0, pos: 0 };

    const sec = cursor.section ?? 0;
    const para = cursor.para ?? 0;
    const charOff = cursor.pos ?? 0;

    const totalRows = tableData.rows.length + (tableData.headers.length > 0 ? 1 : 0);
    const totalCols = tableData.colCount;

    // WASM createTable 호출
    let result: any;
    if (typeof wasm.createTable === 'function') {
      result = wasm.createTable(sec, para, charOff, totalRows, totalCols);
    }

    if (!result || !result.ok) {
      console.warn('[ai-table-pipeline] createTable 실패, 폴백 텍스트 삽입 시도');
      if (typeof hwpCtrlOrWasm.InsertText === 'function') {
        const mdTable = matrixToMarkdownTable([tableData.headers, ...tableData.rows]);
        return hwpCtrlOrWasm.InsertText(mdTable);
      }
      return false;
    }

    const tableParaIdx = result.paraIdx;
    const controlIdx = result.controlIdx ?? 0;

    // 셀 내용 채우기
    const allRows = [tableData.headers, ...tableData.rows];
    for (let r = 0; r < allRows.length; r++) {
      const rowCells = allRows[r];
      for (let c = 0; c < rowCells.length; c++) {
        const cellText = rowCells[c];
        if (cellText && cellText.trim()) {
          const cellIdx = r * totalCols + c;
          if (typeof wasm.insertTextInCell === 'function') {
            wasm.insertTextInCell(sec, tableParaIdx, controlIdx, cellIdx, 0, 0, cellText.trim());
          }
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rhwp-document-updated'));
    }

    return true;
  } catch (err) {
    console.error('[ai-table-pipeline] insertTableToHwp 오류:', err);
    return false;
  }
}
