// 다크테마 FOUC(Flash of Unstyled Content) 방지 — 페이지 렌더 전에 테마를 즉시 적용한다.
//
// 브라우저 확장 CSP(`script-src 'self' 'wasm-unsafe-eval'`)는 인라인 스크립트를 금지하므로,
// 이 로직은 인라인이 아니라 외부 파일로 두고 index.html <head> 최상단에서
// `<script src="/theme-init.js">`(동기)로 로드한다 (#1444). module/defer 를 쓰면 번들 이후
// 실행되어 FOUC 방지 효과를 잃으므로 동기 로드를 유지한다.
(() => {
  const root = document.documentElement;
  const isThemeMode = (value) => value === 'system' || value === 'light' || value === 'dark';
  let mode = 'system';
  try {
    const settings = JSON.parse(localStorage.getItem('rhwp-settings') || '{}');
    const storedMode = settings && settings.theme && settings.theme.mode;
    if (isThemeMode(storedMode)) mode = storedMode;
  } catch {
    mode = 'system';
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective = mode === 'dark' || (mode === 'system' && prefersDark) ? 'dark' : 'light';
  const scheme = `only ${effective}`;
  root.dataset.themeMode = mode;
  root.dataset.themeEffective = effective;
  root.style.colorScheme = scheme;
  const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (colorSchemeMeta) colorSchemeMeta.setAttribute('content', scheme);
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute('content', effective === 'dark' ? '#2b3037' : '#f5f5f5');
})();

// 잔존 dev 서비스 워커 자동 복구.
//
// vite dev 서버와 standalone 서버(server.mjs)는 같은 origin(127.0.0.1:7700)을 쓴다.
// 예전 빌드에서는 `npm run dev` 한 번만으로 이 origin 에 dev 서비스 워커가 등록됐고,
// 그 워커가 "/" 요청을 dev 시절 캐시(CSS <link> 가 없고 /src/main.ts 를 참조하는 소스
// index.html)로 응답해서 hwpai.vbs/.bat 실행이나 PWA 파일 연결 실행 시 화면이 통째로
// 깨진 채 떴다. 그 상태에서는 번들 JS 가 아예 로드되지 않으므로(404) 앱 코드로는 복구할
// 수 없고, 캐시를 타지 않고 항상 서버에서 받아오는 이 파일만이 복구를 수행할 수 있다.
(() => {
  if (!('serviceWorker' in navigator)) return;
  // 만에 하나 복구가 실패해도 새로고침 루프에 빠지지 않게 한 번만 시도한다.
  const ONCE_KEY = 'rhwp-dev-sw-cleanup';
  try {
    if (sessionStorage.getItem(ONCE_KEY)) return;
  } catch {
    return;
  }

  navigator.serviceWorker.getRegistrations().then(async (registrations) => {
    const isDevWorker = (reg) =>
      [reg.active, reg.waiting, reg.installing].some(
        (worker) => worker && worker.scriptURL.includes('/dev-sw.js'),
      );
    const stale = registrations.filter(isDevWorker);
    if (stale.length === 0) return;

    try {
      sessionStorage.setItem(ONCE_KEY, '1');
    } catch {
      /* 세션 저장 실패 시에도 복구는 진행한다 */
    }

    await Promise.all(stale.map((reg) => reg.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    console.warn('[PWA] 오래된 dev 서비스 워커를 제거했습니다. 페이지를 다시 불러옵니다.');
    location.reload();
  }).catch(() => {
    /* 복구 실패 시 조용히 무시 — 최소한 화면 동작을 막지는 않는다 */
  });
})();
