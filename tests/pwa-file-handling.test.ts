import test from 'node:test';
import assert from 'node:assert/strict';

import {
  handlePwaLaunchFiles,
  installPwaFileHandling,
  type FileHandlingLaunchParamsLike,
  type LaunchQueueLike,
  type OpenDocumentBytesPayload,
  type PwaFileHandlingCallbacks,
} from '../src/command/pwa-file-handling.ts';

// HWP5 CFB 매직 바이트
const HWP_CFB_MAGIC = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
// HWPX ZIP 매직 바이트
const ZIP_MAGIC = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);
// HML(HWPML) XML 프리픽스
const HML_XML = '<?xml version="1.0" encoding="UTF-8"?><HWPML Version="2.9" SubVersion="0.0.0" Style="embed">';

function createHandle(name: string, fileContent: string | Uint8Array = HWP_CFB_MAGIC) {
  return {
    kind: 'file' as const,
    name,
    async getFile() {
      const blobParts: BlobPart[] = typeof fileContent === 'string'
        ? [fileContent]
        : [fileContent];
      return new File(blobParts, name, { type: 'application/x-hwp' });
    },
    async createWritable() {
      throw new Error('write should not be called while opening PWA launch files');
    },
  };
}

function createCallbacks() {
  const opened: OpenDocumentBytesPayload[] = [];
  const unsupported: string[] = [];
  const errors: unknown[] = [];
  const multiple: number[] = [];

  const callbacks: PwaFileHandlingCallbacks = {
    openDocumentBytes(payload) {
      opened.push(payload);
    },
    notifyUnsupportedFile(fileName) {
      unsupported.push(fileName);
    },
    notifyError(error) {
      errors.push(error);
    },
    notifyMultipleFiles(count) {
      multiple.push(count);
    },
  };

  return { callbacks, opened, unsupported, errors, multiple };
}

test('installPwaFileHandling은 launchQueue가 없으면 false를 반환한다', () => {
  const { callbacks } = createCallbacks();

  const installed = installPwaFileHandling({}, callbacks);

  assert.equal(installed, false);
});

test('installPwaFileHandling은 launchQueue consumer를 등록한다', () => {
  const { callbacks } = createCallbacks();
  let consumer: ((params: FileHandlingLaunchParamsLike) => void) | null = null;
  const launchQueue: LaunchQueueLike = {
    setConsumer(nextConsumer) {
      consumer = nextConsumer;
    },
  };

  const installed = installPwaFileHandling({ launchQueue }, callbacks);

  assert.equal(installed, true);
  assert.equal(typeof consumer, 'function');
});

test('handlePwaLaunchFiles는 빈 launch를 무시한다', async () => {
  const { callbacks, opened, unsupported, errors } = createCallbacks();

  await handlePwaLaunchFiles({}, callbacks);
  await handlePwaLaunchFiles({ files: [] }, callbacks);

  assert.equal(opened.length, 0);
  assert.equal(unsupported.length, 0);
  assert.equal(errors.length, 0);
});

test('handlePwaLaunchFiles는 미지원 확장자를 로드하지 않는다', async () => {
  const { callbacks, opened, unsupported, errors } = createCallbacks();
  const handle = createHandle('memo.txt');

  await handlePwaLaunchFiles({ files: [handle] }, callbacks);

  assert.equal(opened.length, 0);
  assert.deepEqual(unsupported, ['memo.txt']);
  assert.equal(errors.length, 0);
});

test('handlePwaLaunchFiles는 HWP(CFB) 파일을 open-document-bytes payload로 만든다', async () => {
  const { callbacks, opened, unsupported, errors } = createCallbacks();
  const handle = createHandle('opened.hwp', HWP_CFB_MAGIC);

  await handlePwaLaunchFiles({ files: [handle] }, callbacks);

  assert.equal(unsupported.length, 0);
  assert.equal(errors.length, 0);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].fileName, 'opened.hwp');
  assert.equal(opened[0].fileHandle, handle);
  assert.equal(opened[0].skipUnsavedGuard, false);
  assert.deepEqual(Array.from(opened[0].bytes), Array.from(HWP_CFB_MAGIC));
});

test('handlePwaLaunchFiles는 HWPX(ZIP) 파일도 허용하고 다중 파일은 첫 파일만 연다', async () => {
  const { callbacks, opened, unsupported, multiple } = createCallbacks();
  const first = createHandle('first.hwpx', ZIP_MAGIC);
  const second = createHandle('second.hwp', HWP_CFB_MAGIC);

  await handlePwaLaunchFiles({ files: [first, second] }, callbacks);

  assert.deepEqual(multiple, [2]);
  assert.equal(unsupported.length, 0);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].fileName, 'first.hwpx');
  assert.equal(opened[0].fileHandle, first);
});

test('handlePwaLaunchFiles는 HML 파일도 연다', async () => {
  const { callbacks, opened, unsupported, errors } = createCallbacks();
  const handle = createHandle('opened.hml', HML_XML);

  await handlePwaLaunchFiles({ files: [handle] }, callbacks);

  assert.equal(unsupported.length, 0);
  assert.equal(errors.length, 0);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].fileName, 'opened.hml');
  assert.equal(opened[0].fileHandle, handle);
});

test('handlePwaLaunchFiles는 0바이트 빈 파일을 거부하고 notifyError를 발생시킨다', async () => {
  const { callbacks, opened, unsupported, errors } = createCallbacks();
  const handle = createHandle('empty.hwp', '');

  await handlePwaLaunchFiles({ files: [handle] }, callbacks);

  assert.equal(opened.length, 0);
  assert.equal(unsupported.length, 0);
  assert.equal(errors.length, 1);
  assert.match((errors[0] as Error).message, /빈 파일\(0바이트\)은 열 수 없습니다/);
});

test('handlePwaLaunchFiles는 확장자는 .hwp 이지만 내용이 HWP가 아닌 파일을 거부한다', async () => {
  const { callbacks, opened, unsupported, errors } = createCallbacks();
  // 확장자는 .hwp 이지만 내용은 평문 텍스트
  const handle = createHandle('fake.hwp', 'this is just plain text, not a real HWP file');

  await handlePwaLaunchFiles({ files: [handle] }, callbacks);

  assert.equal(opened.length, 0, '파일이 열려서는 안 된다');
  assert.deepEqual(unsupported, ['fake.hwp'], 'notifyUnsupportedFile이 호출되어야 한다');
  assert.equal(errors.length, 0);
});

test('handlePwaLaunchFiles는 확장자는 .hwpx 이지만 내용이 ZIP이 아닌 파일을 거부한다', async () => {
  const { callbacks, opened, unsupported, errors } = createCallbacks();
  const handle = createHandle('fake.hwpx', '<html><body>not a HWPX</body></html>');

  await handlePwaLaunchFiles({ files: [handle] }, callbacks);

  assert.equal(opened.length, 0);
  assert.deepEqual(unsupported, ['fake.hwpx']);
  assert.equal(errors.length, 0);
});

test('handlePwaLaunchFiles는 getFile 실패를 notifyError로 전달한다', async () => {
  const { callbacks, opened, unsupported, errors } = createCallbacks();
  const boom = new Error('permission denied');
  const handle = {
    kind: 'file' as const,
    name: 'opened.hwp',
    async getFile() {
      throw boom;
    },
    async createWritable() {
      throw new Error('write should not be called');
    },
  };

  await handlePwaLaunchFiles({ files: [handle] }, callbacks);

  assert.equal(opened.length, 0);
  assert.equal(unsupported.length, 0);
  assert.deepEqual(errors, [boom]);
});
