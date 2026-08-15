import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KOREAN_DOCUMENT_TEMPLATES,
  KOREAN_TONE_PRESETS,
  getTemplateById,
  getTonePresetById,
} from '../src/core/korean-document-templates.ts';

test('한국 표준 공문서 템플릿 목록이 정상적으로 정의되어 있다', () => {
  assert.ok(KOREAN_DOCUMENT_TEMPLATES.length >= 6);

  const gianmun = getTemplateById('gianmun');
  assert.ok(gianmun);
  assert.equal(gianmun?.title, '기안문 (행안부 표준)');
  assert.ok(gianmun?.skeletonMarkdown?.includes('추진 목적'));

  const pumui = getTemplateById('pumui');
  assert.ok(pumui);
  assert.ok(pumui?.skeletonMarkdown?.includes('구매/집행 세부 내역'));
});

test('한국어 톤앤매너 프리셋 4종이 정상적으로 정의되어 있다', () => {
  assert.equal(KOREAN_TONE_PRESETS.length, 4);

  const bulleted = getTonePresetById('bulleted');
  assert.ok(bulleted);
  assert.equal(bulleted?.name, '개조식 정리');

  const official = getTonePresetById('official');
  assert.ok(official);
  assert.equal(official?.name, '공문서 격식체');

  const report = getTonePresetById('report');
  assert.ok(report);
  assert.equal(report?.name, '보고서 요약체');

  const press = getTonePresetById('press');
  assert.ok(press);
  assert.equal(press?.name, '대외 홍보체');
});
