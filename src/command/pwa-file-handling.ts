import {
  isSupportedDocumentFileName,
  type FileSystemFileHandleLike,
} from './file-system-access.ts';
import { detectDocumentByteKind } from '../core/document-signature.ts';

export interface FileHandlingLaunchParamsLike {
  files?: FileSystemFileHandleLike[];
}

export interface LaunchQueueLike {
  setConsumer(consumer: (params: FileHandlingLaunchParamsLike) => void): void;
}

export interface FileHandlingWindowLike {
  launchQueue?: LaunchQueueLike;
}

export interface OpenDocumentBytesPayload {
  bytes: Uint8Array;
  fileName: string;
  fileHandle: FileSystemFileHandleLike;
  skipUnsavedGuard?: boolean;
}

export interface PwaFileHandlingCallbacks {
  openDocumentBytes(payload: OpenDocumentBytesPayload): void;
  notifyUnsupportedFile(fileName: string): void;
  notifyError(error: unknown): void;
  notifyMultipleFiles?(count: number): void;
}

async function readLaunchFileFromHandle(handle: FileSystemFileHandleLike): Promise<{
  name: string;
  bytes: Uint8Array;
}> {
  const file = await handle.getFile();
  return {
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}

export async function handlePwaLaunchFiles(
  params: FileHandlingLaunchParamsLike,
  callbacks: PwaFileHandlingCallbacks,
): Promise<void> {
  const handles = params.files ?? [];
  if (handles.length === 0) return;
  if (handles.length > 1) callbacks.notifyMultipleFiles?.(handles.length);

  const handle = handles[0];
  if (!isSupportedDocumentFileName(handle.name)) {
    callbacks.notifyUnsupportedFile(handle.name);
    return;
  }

  try {
    const { bytes, name } = await readLaunchFileFromHandle(handle);
    if (!isSupportedDocumentFileName(name)) {
      callbacks.notifyUnsupportedFile(name);
      return;
    }
    if (bytes.byteLength === 0) {
      callbacks.notifyError(new Error(`빈 파일(0바이트)은 열 수 없습니다: ${name}`));
      return;
    }

    // 파일 시그니처(매직 넘버) 검증: 확장자가 .hwp/.hwpx/.hml 이더라도 실제 바이트
    // 내용이 HWP(CFB/HWP3), HWPX(ZIP), HML(HWPML XML)이 아니면 WASM 파서에
    // 전달하기 전에 차단한다. 이를 통해 UNSUPPORTED_FILE_FORMAT 오류를 방지한다.
    const byteKind = detectDocumentByteKind(bytes);
    if (byteKind !== 'hwp' && byteKind !== 'hwpx' && byteKind !== 'hml') {
      callbacks.notifyUnsupportedFile(name);
      return;
    }

    callbacks.openDocumentBytes({
      bytes,
      fileName: name,
      fileHandle: handle,
      skipUnsavedGuard: false,
    });
  } catch (error) {
    callbacks.notifyError(error);
  }
}

// ─── 세션 복원 중복 실행 방지 ─────────────────────────────
//
// Edge/Chrome은 --win-session-start 로 부팅 시 이전 세션을 복원하며,
// 이때 설치된 PWA 창도 다시 열린다. 브라우저에 따라 이전 세션의
// launchQueue 파일 파라미터가 "재생"되어 사용자가 의도하지 않은 파일
// 로드(와 오류 다이얼로그)가 발생할 수 있다.
//
// sessionStorage는 세션 복원 시 보존되므로 이를 활용한다:
// - 매 페이지 로드마다 고유 launchToken을 생성한다.
// - launchQueue 파일 처리 시 (이전 토큰, 같은 파일명) 조합이면
//   "세션 복원 재생"으로 판정하여 건너뛴다.
// - 같은 페이지 로드 내에서 같은 파일이 다시 열리면(토큰 일치)
//   정상 처리한다(사용자가 의도적으로 다시 연 것).

const SESSION_KEY_TOKEN = '__rhwp_pwa_launch_token';
const SESSION_KEY_FILE = '__rhwp_pwa_launch_file';

interface SessionLaunchState {
  token: string;
  file: string;
}

function readSessionLaunchState(): SessionLaunchState | null {
  try {
    const token = sessionStorage.getItem(SESSION_KEY_TOKEN);
    const file = sessionStorage.getItem(SESSION_KEY_FILE);
    return token && file ? { token, file } : null;
  } catch {
    return null;
  }
}

function writeSessionLaunchState(token: string, file: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY_TOKEN, token);
    sessionStorage.setItem(SESSION_KEY_FILE, file);
  } catch { /* sessionStorage 사용 불가 환경 무시 */ }
}

export function installPwaFileHandling(
  windowLike: FileHandlingWindowLike,
  callbacks: PwaFileHandlingCallbacks,
): boolean {
  if (!windowLike.launchQueue?.setConsumer) return false;

  // 이번 페이지 로드의 고유 토큰. 세션 복원 시에는 새 토큰이 생성되므로
  // 이전 세션에서 저장한 토큰과 달라진다.
  const currentLaunchToken =
    `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  windowLike.launchQueue.setConsumer((params) => {
    const files = params.files ?? [];
    if (files.length === 0) return;

    const fileName = files[0].name;
    const prev = readSessionLaunchState();

    // 동일 파일명 + 다른 토큰(= 다른 페이지 로드) → 세션 복원 재생으로 판정
    if (prev && prev.file === fileName && prev.token !== currentLaunchToken) {
      console.info(
        '[pwa-file-handling] 세션 복원 시 중복 파일 실행 건너뜀:',
        fileName,
      );
      // 토큰을 갱신하여 이후 같은 파일의 명시적 열기는 허용한다
      writeSessionLaunchState(currentLaunchToken, fileName);
      return;
    }

    writeSessionLaunchState(currentLaunchToken, fileName);
    void handlePwaLaunchFiles(params, callbacks);
  });
  return true;
}
