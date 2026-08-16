import { defineConfig } from 'vite';
import { resolve, extname, join } from 'path';
import { readFileSync, readFile } from 'fs';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const subsecondWasmDir = resolve(
  __dirname,
  '..',
  'target',
  'rhwp-subsecond-vite',
);
const useSubsecondWasm = process.env.RHWP_SUBSECOND === '1';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // 셀프 호스팅 빌드에서 외부(CDN) 웹폰트 로드를 빌드 시점에 끈다.
    // 확장 storage 설정(disableExternalWebFonts)이 있으면 그 값이 우선한다.
    __RHWP_DISABLE_EXTERNAL_WEBFONTS__: JSON.stringify(
      process.env.RHWP_DISABLE_EXTERNAL_WEBFONTS === '1',
    ),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@wasm/rhwp.js': useSubsecondWasm
        ? resolve(subsecondWasmDir, 'rhwp-subsecond.js')
        : resolve(__dirname, 'pkg', 'rhwp.js'),
      '@wasm': resolve(__dirname, '..', 'pkg'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 7700,
    proxy: useSubsecondWasm ? {
      '/_dioxus': {
        target: 'http://127.0.0.1:7711',
        ws: true,
      },
      '/wasm': {
        target: 'http://127.0.0.1:7711',
      },
    } : undefined,
    fs: {
      // [Task #741 후속] 외부 file path 그림 영역 영역 samples/ dir 영역 영역 fetch 가능 영역.
      allow: [
        __dirname,
        resolve(__dirname, '..', 'pkg'),
        subsecondWasmDir,
        resolve(__dirname, '..', 'samples'),
        resolve(__dirname, '..', 'npm', 'editor'),
      ],
    },
    watch: {
      ignored: ['**/librhwp-subsecond-patch-*.wasm'],
    },
  },
  plugins: [
    {
      name: 'ignore-subsecond-patch-artifacts',
      handleHotUpdate(context) {
        if (/librhwp-subsecond-patch-\d+\.wasm$/.test(context.file)) {
          return [];
        }
      },
    },
    // [Task #741 후속] dev 서버 영역 영역 /samples/* 경로 영역 영역 parent samples/ dir 영역
    // 영역 정적 serve 영역 — wasm-bridge.ts 영역 영역 외부 image fetch 영역 영역 영역.
    {
      name: 'serve-samples-dir',
      configureServer(server) {
        const samplesDir = resolve(__dirname, '..', 'samples');
        server.middlewares.use('/samples', (req, res, next) => {
          if (!req.url) return next();
          // URL decode + sanitize (path traversal 차단)
          const reqPath = decodeURIComponent(req.url.split('?')[0]);
          const relPath = reqPath.replace(/^\/+/, '');
          if (relPath.includes('..')) { res.statusCode = 403; return res.end(); }
          const full = join(samplesDir, relPath);
          if (!full.startsWith(samplesDir)) { res.statusCode = 403; return res.end(); }
          readFile(full, (err: NodeJS.ErrnoException | null, data: Buffer) => {
            if (err) { res.statusCode = 404; return res.end(); }
            const ext = extname(full).toLowerCase();
            const mime: Record<string, string> = {
              '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
              '.png': 'image/png', '.bmp': 'image/bmp', '.webp': 'image/webp',
            };
            res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream');
            // [Task #741 후속] OS 영역 절대 경로 영역 영역 response header 영역 노출 — JS
            // 영역 영역 dialog 영역 영역 한컴 viewer 정합 (D:\\... 영역 영역 영역 의 영역 영역) 영역.
            res.setHeader('X-File-Path', encodeURI(full));
            res.setHeader('Access-Control-Expose-Headers', 'X-File-Path');
            res.end(data);
          });
        });
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'favicon.png', 'icons/*.png'],
      manifest: {
        id: './',
        name: 'hwp+AI Editor',
        short_name: 'hwp+AI',
        description: '100% 오프라인 로컬 기반 HWPX AI 에디터 — hwp+AI Editor',
        lang: 'ko',
        theme_color: '#2b6cb0',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        scope: './',
        categories: ['productivity', 'utilities'],
        file_handlers: [
          {
            action: './',
            accept: {
              'application/x-hwp': ['.hwp'],
              'application/haansofthwp': ['.hwp'],
              'application/vnd.hancom.hwp': ['.hwp'],
              'application/hwp+zip': ['.hwpx'],
              'application/vnd.hancom.hwpx': ['.hwpx'],
              'application/vnd.hancom.hml': ['.hml'],
            },
          },
        ],
        icons: [
          { src: 'icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // WASM (~12 MB) is kept out of precache to avoid blocking SW installation;
        // CacheFirst at runtime still gives offline access after the first load.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2,ttf,otf}'],
        // public/dev-sw.js 는 남아 있는 dev 워커를 제거하는 kill switch 이므로
        // 프로덕션 워커가 precache 할 대상이 아니다.
        globIgnores: ['dev-sw.js'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-cache',
              expiration: { maxEntries: 5, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      // dev 서비스 워커는 절대 켜지 않는다.
      // dev 서버와 standalone 서버(server.mjs)가 같은 origin(127.0.0.1:7700)을 쓰기 때문에,
      // dev 워커가 한 번 등록되면 이후 standalone/PWA 실행 시에도 그 워커가 "/" 요청을
      // 가로채 dev 시절 소스 index.html(= CSS <link> 없음, /src/main.ts 참조)을 돌려주고
      // 화면이 전부 깨진 채로 뜬다. 남아 있는 등록은 public/dev-sw.js 가 정리한다.
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
