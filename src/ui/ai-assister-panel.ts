import { OllamaClient, OllamaChatMessage } from '@/core/ollama';
import { HwpCtrl } from '@/hwpctl';
import { showToast } from '@/ui/toast';
import { formatMarkdownToHtml, insertFormattedTextToHwp, formatMarkdownToHwpText, getFullDocumentText } from '@/core/ai-formatter';

export class AiAssisterPanel {
  private panelElement: HTMLElement;
  private ollamaClient: OllamaClient;
  private hwpCtrlGetter: () => HwpCtrl | null;
  private activeTab: string = 'chat';
  private chatHistory: OllamaChatMessage[] = [];
  private isGenerating: boolean = false;

  constructor(ollamaClient: OllamaClient, hwpCtrlGetter: () => HwpCtrl | null) {
    this.ollamaClient = ollamaClient;
    this.hwpCtrlGetter = hwpCtrlGetter;

    this.panelElement = document.createElement('aside');
    this.panelElement.id = 'ai-assister-panel';
    this.panelElement.className = 'ai-panel';
    this.panelElement.innerHTML = `
      <div class="ai-panel-header">
        <div class="ai-panel-title">
          <span class="ai-icon">🤖</span>
          <strong>AI Assister</strong>
          <span class="ai-model-tag">gemma4:e2b</span>
        </div>
        <div class="ai-panel-status" id="ai-status-indicator" title="Ollama 연결 상태 확인 중...">
          <span class="status-dot"></span>
          <span class="status-text">연결 확인 중</span>
        </div>
      </div>

      <div class="ai-panel-tabs">
        <button class="ai-tab-btn active" data-tab="chat">💬 AI 대화/생성</button>
        <button class="ai-tab-btn" data-tab="summary">📑 문서 요약</button>
        <button class="ai-tab-btn" data-tab="fields">📝 양식 채우기</button>
        <button class="ai-tab-btn" data-tab="proofread">🔍 맞춤법 검사</button>
      </div>

      <div class="ai-panel-content">
        <!-- 💬 Tab 1: AI 대화 & 생성 -->
        <div class="ai-tab-content active" id="tab-chat">
          <div class="ai-template-chips">
            <button class="ai-chip" data-template="보고서 개요 작성">📄 보고서 개요 작성</button>
            <button class="ai-chip" data-template="개조식(Bulleted) 변환">📌 개조식 정리</button>
            <button class="ai-chip" data-template="공문서 인사말 생성">✉️ 공문서 인사말</button>
            <button class="ai-chip" data-template="결론 및 요약 작성">🎯 결론/요약 작성</button>
          </div>

          <div class="ai-chat-output" id="ai-chat-history">
            <div class="ai-msg ai-msg-system">
              👋 안녕하세요! 로컬 LLM <strong>gemma4:e2b</strong> 기반 HWPX AI 도우미입니다.<br/>
              무엇을 도와드릴까요?
            </div>
          </div>

          <div class="ai-chat-input-wrap">
            <textarea id="ai-prompt-input" placeholder="AI에게 요청할 프롬프트 또는 텍스트 생성을 입력하세요... (Ctrl+Enter로 전송)"></textarea>
            <div class="ai-input-controls">
              <label class="ai-checkbox-label">
                <input type="checkbox" id="ai-include-context" checked /> 문서 맥락 포함
              </label>
              <button class="ai-btn ai-btn-secondary ai-btn-sm" id="ai-btn-clear-chat" title="이전 대화 히스토리 초기화">🧹 초기화</button>
              <button class="ai-btn ai-btn-primary" id="ai-btn-send">보내기</button>
            </div>
          </div>
        </div>

        <!-- 📑 Tab 2: 문서 요약 & 분석 -->
        <div class="ai-tab-content" id="tab-summary">
          <div class="ai-tab-header">
            <p>현재 HWPX 문서의 전체 구조와 핵심 내용을 분석하여 요약 리포트를 제공합니다.</p>
            <button class="ai-btn ai-btn-primary" id="ai-btn-analyze-doc">📊 전체 문서 분석 및 요약 실행</button>
          </div>
          <div class="ai-analysis-result" id="ai-summary-result">
            <div class="ai-placeholder">위 버튼을 눌러 문서 전체 분석을 시작하세요.</div>
          </div>
        </div>

        <!-- 📝 Tab 3: 양식/누름틀 자동 채우기 -->
        <div class="ai-tab-content" id="tab-fields">
          <div class="ai-tab-header">
            <p>문서 내 누름틀/필드(Field) 목록을 감지하고, AI가 자동으로 적절한 데이터를 작성합니다.</p>
            <button class="ai-btn ai-btn-primary" id="ai-btn-scan-fields">🔍 필드 감지 및 자동 완성</button>
          </div>
          <div class="ai-fields-list" id="ai-fields-container">
            <div class="ai-placeholder">필드 감지 버튼을 눌러 문서 양식을 확인하세요.</div>
          </div>
        </div>

        <!-- 🔍 Tab 4: 맞춤법 & 문체 검사기 -->
        <div class="ai-tab-content" id="tab-proofread">
          <div class="ai-tab-header">
            <p>문서 전체의 맞춤법, 띄어쓰기, 어색한 문장을 탐지하고 원클릭으로 교정합니다.</p>
            <button class="ai-btn ai-btn-primary" id="ai-btn-full-proofread">✨ 전체 맞춤법 검사 실행</button>
          </div>
          <div class="ai-proofread-results" id="ai-proofread-container">
            <div class="ai-placeholder">전체 검사를 실행하면 교정이 필요한 문장 목록이 나타납니다.</div>
          </div>
        </div>
      </div>
    `;

    this.initEvents();
    this.checkHealth();
  }

  getElement(): HTMLElement {
    return this.panelElement;
  }

  /** 새 문서 로드 / 생성 / 닫기 시 AI Assister 이전 히스토리 및 결과 완전 초기화 */
  resetState(documentName?: string) {
    this.chatHistory = [];
    this.isGenerating = false;

    // 1. 대화창 히스토리 리셋
    const chatHistoryEl = this.panelElement.querySelector('#ai-chat-history') as HTMLElement;
    if (chatHistoryEl) {
      const docLabel = documentName ? `문서 [${documentName}]` : '새 문서';
      chatHistoryEl.innerHTML = `
        <div class="ai-msg ai-msg-system">
          📄 <strong>${docLabel}</strong>(이)가 로드되었습니다.<br/>
          이전 대화 기록이 초기화되었으며, 현재 문서 텍스트를 실시간으로 인식합니다.
        </div>
      `;
    }

    // 2. 요약 및 분석 탭 리셋
    const summaryContainer = this.panelElement.querySelector('#ai-summary-result') as HTMLElement;
    if (summaryContainer) {
      summaryContainer.innerHTML = `<div class="ai-placeholder">버튼을 눌러 ${documentName ? `[${documentName}]` : '현재 문서'}의 전체 분석을 시작하세요.</div>`;
    }

    // 3. 필드 탭 리셋
    const fieldsContainer = this.panelElement.querySelector('#ai-fields-container') as HTMLElement;
    if (fieldsContainer) {
      fieldsContainer.innerHTML = `<div class="ai-placeholder">필드 감지 버튼을 눌러 문서 양식을 확인하세요.</div>`;
    }

    // 4. 맞춤법 검사 탭 리셋
    const proofreadContainer = this.panelElement.querySelector('#ai-proofread-container') as HTMLElement;
    if (proofreadContainer) {
      proofreadContainer.innerHTML = `<div class="ai-placeholder">전체 검사를 실행하면 교정이 필요한 문장 목록이 나타납니다.</div>`;
    }

    // 5. 프롬프트 입력창 비우기
    const inputEl = this.panelElement.querySelector('#ai-prompt-input') as HTMLTextAreaElement;
    if (inputEl) {
      inputEl.value = '';
    }
  }

  /** Ollama 상태 체크 */
  private async checkHealth() {
    const statusEl = this.panelElement.querySelector('#ai-status-indicator') as HTMLElement;
    const isOk = await this.ollamaClient.isModelAvailable('gemma4:e2b');

    if (isOk) {
      statusEl.className = 'ai-panel-status online';
      statusEl.innerHTML = `<span class="status-dot"></span><span class="status-text">Ollama 준비됨</span>`;
      statusEl.title = 'gemma4:e2b 모델 연결됨';
    } else {
      statusEl.className = 'ai-panel-status offline';
      statusEl.innerHTML = `<span class="status-dot"></span><span class="status-text">Ollama 오프라인</span>`;
      statusEl.title = 'http://localhost:11434 의 gemma4:e2b 모델 확인 실패';
    }
  }

  private initEvents() {
    // 탭 전환
    const tabBtns = this.panelElement.querySelectorAll('.ai-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tab = target.dataset.tab || 'chat';

        tabBtns.forEach(b => b.classList.remove('active'));
        target.classList.add('active');

        const contents = this.panelElement.querySelectorAll('.ai-tab-content');
        contents.forEach(c => c.classList.remove('active'));

        const activeContent = this.panelElement.querySelector(`#tab-${tab}`);
        activeContent?.classList.add('active');
        this.activeTab = tab;
      });
    });

    // 프롬프트 칩 클릭
    const chips = this.panelElement.querySelectorAll('.ai-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const template = (chip as HTMLElement).dataset.template;
        const input = this.panelElement.querySelector('#ai-prompt-input') as HTMLTextAreaElement;
        if (input && template) {
          input.value = `${template}: `;
          input.focus();
        }
      });
    });

    // 전송 버튼 및 Ctrl+Enter
    const sendBtn = this.panelElement.querySelector('#ai-btn-send');
    const promptInput = this.panelElement.querySelector('#ai-prompt-input') as HTMLTextAreaElement;

    sendBtn?.addEventListener('click', () => this.handleSendMessage());
    promptInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // 대화 초기화 버튼
    const clearChatBtn = this.panelElement.querySelector('#ai-btn-clear-chat');
    clearChatBtn?.addEventListener('click', () => {
      this.chatHistory = [];
      const chatHistoryEl = this.panelElement.querySelector('#ai-chat-history') as HTMLElement;
      if (chatHistoryEl) {
        chatHistoryEl.innerHTML = `
          <div class="ai-msg ai-msg-system">
            👋 대화 히스토리가 초기화되었습니다.<br/>
            새로운 요청을 입력하세요.
          </div>
        `;
      }
      showToast('이전 대화 히스토리가 초기화되었습니다.');
    });

    // 문서 분석 버튼
    const analyzeBtn = this.panelElement.querySelector('#ai-btn-analyze-doc');
    analyzeBtn?.addEventListener('click', () => this.handleAnalyzeDocument());

    // 필드 감지 버튼
    const scanFieldsBtn = this.panelElement.querySelector('#ai-btn-scan-fields');
    scanFieldsBtn?.addEventListener('click', () => this.handleScanFields());

    // 전체 맞춤법 검사 버튼
    const proofreadBtn = this.panelElement.querySelector('#ai-btn-full-proofread');
    proofreadBtn?.addEventListener('click', () => this.handleFullProofread());
  }

  /** 메시지 전송 및 LLM 응답 처리 (멀티턴 컨텍스트 적용) */
  private async handleSendMessage() {
    if (this.isGenerating) return;

    const inputEl = this.panelElement.querySelector('#ai-prompt-input') as HTMLTextAreaElement;
    const userPrompt = inputEl.value.trim();
    if (!userPrompt) return;

    const includeContext = (this.panelElement.querySelector('#ai-include-context') as HTMLInputElement)?.checked;
    const chatHistoryEl = this.panelElement.querySelector('#ai-chat-history') as HTMLElement;

    // 사용자 메시지 추가
    const userMsgEl = document.createElement('div');
    userMsgEl.className = 'ai-msg ai-msg-user';
    userMsgEl.textContent = userPrompt;
    chatHistoryEl.appendChild(userMsgEl);

    inputEl.value = '';
    this.isGenerating = true;

    // AI 메시지 버블 생성 (스트리밍)
    const aiMsgEl = document.createElement('div');
    aiMsgEl.className = 'ai-msg ai-msg-assistant';
    aiMsgEl.innerHTML = `
      <div class="ai-msg-header">🤖 gemma4:e2b</div>
      <div class="ai-msg-body"><span class="ai-loading-dots">AI 응답 생성 중...</span></div>
      <div class="ai-msg-actions hidden">
        <button class="ai-btn-action" data-action="insert">📄 커서 위치에 삽입</button>
        <button class="ai-btn-action" data-action="copy">📋 복사</button>
      </div>
    `;
    chatHistoryEl.appendChild(aiMsgEl);
    chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;

    const bodyEl = aiMsgEl.querySelector('.ai-msg-body') as HTMLElement;
    const actionsEl = aiMsgEl.querySelector('.ai-msg-actions') as HTMLElement;

    // 문서 맥락 추출
    const hwpCtrl = this.hwpCtrlGetter();
    let liveDocText = '';
    if (hwpCtrl) {
      liveDocText = getFullDocumentText(hwpCtrl);
    }

    let systemContent = '당신은 한국어 HWPX 공문서 및 보고서 작성을 돕는 유능한 AI 어시스턴트입니다. 해시태그(#)나 과도한 마크다운 기호 없이, 한글 문서에 적합한 가독성 높은 문단과 불렛포인트(•)로 단정하게 정리하여 답변해 주세요.';
    if (includeContext && liveDocText) {
      systemContent += `\n\n[현재 HWPX 문서 내용]\n${liveDocText}`;
    }

    // 멀티턴 대화 히스토리 구성 (시스템 프롬프트 + 최근 대화 최대 10개 메시지/5턴 + 현재 질의)
    const messagesToSend: OllamaChatMessage[] = [
      { role: 'system', content: systemContent },
      ...this.chatHistory.slice(-10),
      { role: 'user', content: userPrompt },
    ];

    try {
      let generatedText = '';
      await this.ollamaClient.chat(messagesToSend, {
        onToken: (_chunk, full) => {
          generatedText = full;
          bodyEl.innerHTML = formatMarkdownToHtml(full);
          chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
        },
      });

      // 성공적으로 생성이 끝나면 대화 히스토리에 유저 메시지 및 Assistant 답변 저장
      this.chatHistory.push({ role: 'user', content: userPrompt });
      this.chatHistory.push({ role: 'assistant', content: generatedText });

      actionsEl.classList.remove('hidden');

      // 액션 버튼 이벤트
      const insertBtn = actionsEl.querySelector('[data-action="insert"]');
      const copyBtn = actionsEl.querySelector('[data-action="copy"]');

      insertBtn?.addEventListener('click', () => {
        const activeHwpCtrl = this.hwpCtrlGetter();
        if (activeHwpCtrl) {
          insertFormattedTextToHwp(activeHwpCtrl, generatedText);
          window.dispatchEvent(new CustomEvent('rhwp-document-updated'));
          showToast('커서 위치에 텍스트가 삽입되었습니다.');
        } else {
          showToast('에디터 연결이 활성화되지 않았습니다.');
        }
      });

      copyBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(formatMarkdownToHwpText(generatedText));
        showToast('클립보드에 복사되었습니다.');
      });

    } catch (err) {
      bodyEl.textContent = `[오류] LLM 생성에 실패했습니다: ${err}`;
    } finally {
      this.isGenerating = false;
    }
  }

  /** 전체 문서 분석 및 요약 */
  private async handleAnalyzeDocument() {
    const summaryContainer = this.panelElement.querySelector('#ai-summary-result') as HTMLElement;
    const hwpCtrl = this.hwpCtrlGetter();
    if (!summaryContainer) return;

    const docText = hwpCtrl ? getFullDocumentText(hwpCtrl) : '';

    if (!hwpCtrl || !docText || docText.trim().length === 0) {
      summaryContainer.innerHTML = `
        <div class="ai-info" style="line-height: 1.6;">
          ⚠️ <strong>에디터에 로드된 문서 내용이 없습니다.</strong><br/>
          HWPX 문서를 열거나 에디터에 내용을 작성한 후 요약 분석을 실행해 주세요.
        </div>
      `;
      return;
    }

    summaryContainer.innerHTML = `<div class="ai-loading">문서 텍스트를 파싱하고 gemma4:e2b로 요약 분석 중입니다...</div>`;

    try {
      const pageCount = hwpCtrl.PageCount() || 1;
      const prompt = `[현재 HWPX 문서 내용 (총 ${pageCount}페이지)]\n${docText}\n\n[요청사항]\n위 문서의 전체 요약, 주요 핵심 포인트(Bulleted list), 문서 톤앤매너 평가를 작성해주세요.`;

      await this.ollamaClient.generate(prompt, {
        onToken: (_chunk, full) => {
          summaryContainer.innerHTML = `<div class="ai-summary-box">${formatMarkdownToHtml(full)}</div>`;
        },
      });
    } catch (err) {
      summaryContainer.innerHTML = `<div class="ai-error">문서 분석 실패 (Ollama 서비스 상태 확인 필요): ${err}</div>`;
    }
  }

  /** 양식/누름틀 감지 및 자동 완성 */
  private async handleScanFields() {
    const container = this.panelElement.querySelector('#ai-fields-container') as HTMLElement;
    const hwpCtrl = this.hwpCtrlGetter();
    if (!container) return;

    const docText = hwpCtrl ? getFullDocumentText(hwpCtrl) : '';

    if (!hwpCtrl || !docText || docText.trim().length === 0) {
      container.innerHTML = `
        <div class="ai-info" style="line-height: 1.6;">
          ⚠️ <strong>에디터에 로드된 문서 내용이 없습니다.</strong><br/>
          누름틀/필드가 포함된 양식 문서를 먼저 열어주세요.
        </div>
      `;
      return;
    }

    container.innerHTML = `<div class="ai-loading">문서 내 누름틀/필드 탐지 중...</div>`;

    try {
      const fields = hwpCtrl.GetFieldList();
      if (!fields || fields.length === 0) {
        container.innerHTML = `
          <div class="ai-info" style="line-height:1.6;">
            📌 <strong>문서 내 감지된 누름틀/필드가 없습니다.</strong><br/>
            양식 문서(신청서, 계약서, 보고서 서식 등)에 설정된 필드가 있는 경우 이곳에 표시되어 AI가 자동 입력을 수행합니다.<br/><br/>
            <button class="ai-btn ai-btn-primary" id="ai-btn-demo-fields">💡 예시 누름틀 텍스트 에디터에 생성하기</button>
          </div>
        `;

        container.querySelector('#ai-btn-demo-fields')?.addEventListener('click', () => {
          hwpCtrl.InsertText('작성자: {{성명}} / 작성일자: {{날짜}} / 부서: {{부서명}}\n');
          window.dispatchEvent(new CustomEvent('rhwp-document-updated'));
          showToast('에디터 커서 위치에 누름틀 예시가 생성되었습니다.');
        });
        return;
      }

      let html = `<div class="ai-fields-count">총 ${fields.length}개의 필드가 감지되었습니다.</div><ul class="ai-field-list">`;
      fields.forEach((f: any) => {
        const currentVal = hwpCtrl.GetFieldText(f.name);
        html += `
          <li class="ai-field-item" data-field="${f.name}">
            <div class="field-info">
              <strong>${f.name}</strong>
              <span class="field-val">${currentVal || '(비어있음)'}</span>
            </div>
            <button class="ai-btn ai-btn-sm" data-field-act="auto">AI 추천 채우기</button>
          </li>
        `;
      });
      html += `</ul>`;
      container.innerHTML = html;

      // 필드 클릭 이벤트
      container.querySelectorAll('[data-field-act="auto"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const item = (e.currentTarget as HTMLElement).closest('.ai-field-item') as HTMLElement;
          const fieldName = item?.dataset.field;
          if (!fieldName) return;

          const valSpan = item.querySelector('.field-val') as HTMLElement;
          valSpan.textContent = 'AI 생성 중...';

          try {
            const activeCtrl = this.hwpCtrlGetter();
            const textContent = activeCtrl ? getFullDocumentText(activeCtrl, 2000) : '';
            const prompt = `[현재 문서 내용 일부]\n${textContent}\n\nHWPX 양식 필드이름: "${fieldName}". 위 문서 맥락에 맞게 이 필드에 들어갈 적절한 추천 입력값(예: 홍길동, 2026-08-13, 기획팀 등)을 1단어 또는 짧은 구로 출력하세요. 설명은 생략하세요.`;
            const suggested = await this.ollamaClient.generate(prompt);
            const cleanText = formatMarkdownToHwpText(suggested).trim();

            if (activeCtrl) {
              activeCtrl.PutFieldText(fieldName, cleanText);
            }
            valSpan.textContent = cleanText;
            showToast(`필드 "${fieldName}" 에 "${cleanText}" 입력 완료!`);
          } catch (err) {
            valSpan.textContent = '실패';
            showToast(`필드 채우기 실패: ${err}`);
          }
        });
      });
    } catch (e) {
      container.innerHTML = `<div class="ai-error">필드 감지 실패: ${e}</div>`;
    }
  }

  /** 전체 맞춤법 검사 */
  private async handleFullProofread() {
    const container = this.panelElement.querySelector('#ai-proofread-container') as HTMLElement;
    const hwpCtrl = this.hwpCtrlGetter();
    if (!container) return;

    const docText = hwpCtrl ? getFullDocumentText(hwpCtrl) : '';

    if (!hwpCtrl || !docText || docText.trim().length === 0) {
      container.innerHTML = `
        <div class="ai-info" style="line-height: 1.6;">
          ⚠️ <strong>검사할 문서 내용이 없습니다.</strong><br/>
          HWPX 문서를 먼저 열거나 에디터에 문장을 작성한 후 맞춤법 검사를 실행해 주세요.
        </div>
      `;
      return;
    }

    container.innerHTML = `<div class="ai-loading">문서 내 오탈자 및 맞춤법 검사 중...</div>`;

    try {
      const prompt = `[현재 HWPX 문서 내용]\n${docText}\n\n[요청사항]\n위 문서 전체의 맞춤법, 띄어쓰기, 어색한 어휘를 탐지하고 교정 결과를 다음 형식으로 출력해주세요:\n1. 원본문장 -> 교정문장 (사유)\n2. 원본문장 -> 교정문장 (사유)`;

      await this.ollamaClient.generate(prompt, {
        onToken: (_chunk, full) => {
          container.innerHTML = `<div class="ai-proofread-box">${formatMarkdownToHtml(full)}</div>`;
        },
      });
    } catch (err) {
      container.innerHTML = `<div class="ai-error">맞춤법 검사 실패 (Ollama 상태 확인 필요): ${err}</div>`;
    }
  }
}

/** 패널 드래그 리사이즈 기능 연결 */
export function makePanelResizable(resizerEl: HTMLElement, panelEl: HTMLElement, onResize?: () => void) {
  let isDragging = false;
  let startX = 0;
  let startWidth = 0;

  // 저장된 폭 복원
  const savedWidth = localStorage.getItem('rhwp-ai-panel-width');
  if (savedWidth) {
    const parsed = parseInt(savedWidth, 10);
    if (!isNaN(parsed) && parsed >= 240 && parsed <= 800) {
      panelEl.style.width = `${parsed}px`;
    }
  }

  resizerEl.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startWidth = panelEl.getBoundingClientRect().width;
    resizerEl.classList.add('is-dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    panelEl.style.transition = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dx = startX - e.clientX;
    const newWidth = Math.min(Math.max(startWidth + dx, 240), Math.min(window.innerWidth * 0.6, 800));

    panelEl.style.width = `${newWidth}px`;
    if (onResize) onResize();
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      resizerEl.classList.remove('is-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      panelEl.style.transition = '';

      const currentWidth = panelEl.getBoundingClientRect().width;
      localStorage.setItem('rhwp-ai-panel-width', String(Math.round(currentWidth)));
      window.dispatchEvent(new Event('resize'));
    }
  });
}
