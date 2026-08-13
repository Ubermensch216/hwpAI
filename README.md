# 📄 hwp+AI Editor — Local HWPX AI Editor Studio

> **100% 로컬 / 오프라인(Air-Gapped) 기반 AI 조수 결합 HWPX 에디터 & 데스크톱 스탠드얼론 앱**  
> 외부 네트워크 통신 0 Byte, 데이터 유출 걱정 없는 보안 한글(HWPX) 문서 편집 & 로컬 LLM (`gemma4:e2b`) 통합 에디터

---

## 🛡️ 프로젝트 정체성 (Core Identity)

1. **클라우드 API 통신 0%**: OpenAI, Anthropic, Google Cloud 등 외부 AI API를 일절 사용하지 않고, 사용자의 PC 내부 루프백(`http://localhost:11434`)의 Ollama 로컬 LLM(`gemma4:e2b`)만 사용합니다.
2. **문서 유출 제로 (Zero Data Leakage)**: 문서 파싱, 편집, 렌더링, PDF 변환 등의 모든 고성능 작업이 메모리 내 **Rust WebAssembly Engine**에서 처리되어 외부로 데이터가 전송될 위험이 전혀 없습니다.
3. **완벽한 망분리/오프라인 지원**: 인터넷 연결을 차단(Wi-Fi off / 랜선 제거)하더라도 모든 편집 및 AI 기능이 100% 정상 작동합니다.
4. **데스크톱 스탠드얼론(Stand-Alone) 지원**: 웹 브라우저 PWA 모드 및 **Tauri v2 네이티브 데스크톱 실행 파일(.exe)**을 완벽 지원합니다.

---

## 🚀 실행 명령어 목록

```bash
# 개발 서버 (포트 7700)
npm run dev

# 프로덕션 빌드 (dist/)
npm run build

# Tauri 데스크톱 개발 실행
npm run dev:tauri

# Tauri Windows 실행 파일 (hwpai.exe / .msi) 빌드
npm run build:tauri
```

Windows에서는 `hwpai.bat`(콘솔 표시) 또는 `hwpai.vbs`(콘솔 숨김)를 더블클릭하면
로컬 서버를 띄우고 브라우저 앱 모드로 바로 실행됩니다.
Tauri 번들의 실행 파일 이름은 `hwpai.exe`, 제품명은 `hwp+AI Editor`입니다.
