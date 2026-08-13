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

const server = http.createServer((req, res) => {
  let reqUrl = (req.url || '/').split('?')[0];

  // 구버전/직접 레퍼런스 호환성 리다이렉트 및 매핑
  let filePath = path.join(distDir, reqUrl === '/' ? 'index.html' : reqUrl);

  // 보안: 디렉토리 트래버설 방지
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    return res.end('403 Forbidden');
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
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(content);
    }
  });
});

function listenOnAvailablePort(startPort) {
  server.listen(startPort, HOST, () => {
    const port = server.address().port;
    fs.writeFileSync(path.join(__dirname, 'server-port.txt'), String(port));
    console.log(`[hwp AI Editor Server] http://${HOST}:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[hwp AI Editor Server] Port ${startPort} busy, trying ${startPort + 1}...`);
      listenOnAvailablePort(startPort + 1);
    } else {
      console.error('[hwp AI Editor Server] Error:', err);
    }
  });
}

listenOnAvailablePort(7700);
