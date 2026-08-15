/*
 * dev 서비스 워커 자기소멸(kill switch) 스크립트.
 *
 * vite dev 서버(127.0.0.1:7700)와 standalone 서버(server.mjs, 같은 127.0.0.1:7700)는
 * 브라우저 입장에서 완전히 동일한 origin 이다. 예전에는 VitePWA devOptions 가 켜져 있어
 * `npm run dev` 한 번만 돌려도 이 origin 에 dev 서비스 워커가 등록됐고, 그 워커는
 * NavigationRoute 로 "/" 요청을 dev 시절 캐시(= /src/main.ts 를 참조하고 CSS <link> 가
 * 없는 소스 index.html)로 응답한다. 이후 standalone 서버나 설치된 PWA(파일 연결 실행)로
 * 같은 주소를 열면 서버의 dist/index.html 대신 그 캐시가 뜨면서 CSS/JS 가 전부 빠진
 * 날것의 HTML 이 렌더된다.
 *
 * dev 워커는 `/dev-sw.js?dev-sw` 로 업데이트를 확인하므로, 그 경로에 이 스크립트를
 * 놓아두면 브라우저가 스스로 새 워커로 교체 → 캐시 전부 삭제 → 등록 해제 → 열려 있는
 * 창 새로고침 순서로 복구된다. 새로 등록하는 쪽은 아무도 없으므로, 남아 있는 잘못된
 * 등록을 청소하는 용도로만 동작한다.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (err) {
        console.warn('[dev-sw kill switch] 캐시 삭제 실패', err);
      }

      try {
        await self.registration.unregister();
      } catch (err) {
        console.warn('[dev-sw kill switch] 등록 해제 실패', err);
      }

      // 이미 깨진 화면이 떠 있는 창을 정상 문서로 다시 불러온다.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        try {
          await client.navigate(client.url);
        } catch (err) {
          console.warn('[dev-sw kill switch] 클라이언트 새로고침 실패', err);
        }
      }
    })(),
  );
});
