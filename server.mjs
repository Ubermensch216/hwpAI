import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const HOST = '127.0.0.1';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

// static asset 파일 목록 확인
function findCompiledAsset(ext) {
  const assetsDir = path.join(distDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const target = files.find(f => f.startsWith('index-') && f.endsWith(ext));
    if (target) return path.join(assetsDir, target);
  }
  return null;
}

// 서비스 워커 스크립트는 HTTP 캐시에 남으면 갱신이 밀린다. 항상 새로 받게 한다.
const swScripts = new Set(['/sw.js', '/dev-sw.js', '/registerSW.js']);

// 남아 있는 dev 서비스 워커 등록(`/dev-sw.js?dev-sw`)을 정리하는 kill switch.
// 빌드된 dist 에 없으면(구버전 dist) public 원본으로 대체해서라도 반드시 응답한다.
function resolveDevSwPath() {
  const built = path.join(distDir, 'dev-sw.js');
  if (fs.existsSync(built)) return built;
  const source = path.join(__dirname, 'public', 'dev-sw.js');
  if (fs.existsSync(source)) return source;
  return null;
}

const server = http.createServer((req, res) => {
  let reqUrl = (req.url || '/').split('?')[0];

  // 런처가 "이미 떠 있는 서버인지" 확인하는 용도 (중복 실행/포트 밀림 방지)
  if (reqUrl === '/__hwpai/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ app: 'hwpai', pid: process.pid }));
  }

  // 구버전/직접 레퍼런스 호환성 리다이렉트 및 매핑
  let filePath = path.join(distDir, reqUrl === '/' ? 'index.html' : reqUrl);

  // 보안: 디렉토리 트래버설 방지
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    return res.end('403 Forbidden');
  }

  // 트래버설 검사 이후에 매핑한다 — kill switch 원본은 public/ 에 있어 distDir 밖이지만
  // 요청 경로가 아니라 서버가 고른 고정 경로이므로 안전하다.
  if (reqUrl === '/dev-sw.js') {
    const devSwPath = resolveDevSwPath();
    if (devSwPath) filePath = devSwPath;
  }

  const ext = path.extname(reqUrl).toLowerCase();

  // 소스 CSS 직접 요청 시 번들된 CSS로 호환 리디렉션
  if ((reqUrl.includes('/src/style.css') || reqUrl.includes('ai-assister.css')) && !fs.existsSync(filePath)) {
    const compiledCss = findCompiledAsset('.css');
    if (compiledCss && fs.existsSync(compiledCss)) {
      filePath = compiledCss;
    }
  }

  // 정적 에셋(css, js, wasm, png 등) 요청인데 파일이 없는 경우 index.html을 주면 MIME 오류 발생함 -> 404 처리
  if (ext && ext !== '.html' && !fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end(`404 Not Found: ${reqUrl}`);
  }

  // SPA 경로 라우팅 (확장자 없거나 html 요청 시 index.html 렌더)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  const fileExt = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[fileExt] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`500 Internal Server Error: ${err.code}`);
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': swScripts.has(reqUrl) ? 'no-store' : 'no-cache',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(content);
    }
  });
});

// 이미 그 포트에 떠 있는 것이 우리 서버인지 확인한다.
function probeExistingInstance(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: HOST, port, path: '/__hwpai/ping', timeout: 1000 },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body).app === 'hwpai');
          } catch {
            resolve(false);
          }
        });
      },
    );
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

function listenOnAvailablePort(startPort) {
  server.listen(startPort, HOST, () => {
    const port = server.address().port;
    fs.writeFileSync(path.join(__dirname, 'server-port.txt'), String(port));
    console.log(`[hwp AI Editor Server] http://${HOST}:${port}`);
  });

  // once — 재시도마다 핸들러가 쌓이면 EADDRINUSE 한 번에 여러 번 재귀한다.
  server.once('error', async (err) => {
    if (err.code !== 'EADDRINUSE') {
      console.error('[hwp AI Editor Server] Error:', err);
      return;
    }

    // 이전 실행에서 남은 우리 서버가 그대로 살아 있으면 새로 띄우지 않고 재사용한다.
    // 매번 새 포트로 밀리면 설치된 PWA(파일 연결 실행)가 기억하는 주소와 어긋나
    // 엉뚱한/죽은 포트를 열게 된다.
    if (await probeExistingInstance(startPort)) {
      fs.writeFileSync(path.join(__dirname, 'server-port.txt'), String(startPort));
      console.log(`[hwp AI Editor Server] 이미 실행 중인 서버 재사용 — http://${HOST}:${startPort}`);
      process.exit(0);
    }

    console.log(`[hwp AI Editor Server] Port ${startPort} busy, trying ${startPort + 1}...`);
    listenOnAvailablePort(startPort + 1);
  });
}

listenOnAvailablePort(7700);
