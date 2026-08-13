import { OllamaClient } from '@/core/ollama';
import { showToast } from '@/ui/toast';
import { formatMarkdownToHwpText } from '@/core/ai-formatter';

export class AiInlineToolbar {
  private container: HTMLElement;
  private modalContainer: HTMLElement;
  private ollamaClient: OllamaClient;
  private onApplyCallback?: (replacementText: string, actionType: 'replace' | 'append') => void;
  private selectedText: string = '';
  private currentAiResponse: string = '';

  constructor(ollamaClient: OllamaClient, onApply?: (replacementText: string, actionType: 'replace' | 'append') => void) {
    this.ollamaClient = ollamaClient;
    this.onApplyCallback = onApply;

    this.container = document.createElement('div');
    this.container.className = 'ai-inline-toolbar hidden';
    this.container.innerHTML = `
      <div class="ai-inline-bar">
        <button class="ai-btn" data-action="refine" title="자연스러운 문장으로 다듬기">✨ 문장 다듬기</button>
        <button class="ai-btn" data-action="formal" title="공문서 및 격식체 톤으로 변환">👔 격식체 변환</button>
        <button class="ai-btn" data-action="summarize" title="핵심 내용 요약">✂️ 요약</button>
        <button class="ai-btn" data-action="proofread" title="맞춤법 및 띄어쓰기 교정">🔍 맞춤법</button>
        <div class="ai-inline-input-wrap">
          <input type="text" class="ai-inline-input" placeholder="AI에게 요청할 프롬프트 입력..." />
          <button class="ai-btn ai-btn-primary" data-action="custom">실행</button>
        </div>
      </div>
    `;

    this.modalContainer = document.createElement('div');
    this.modalContainer.className = 'ai-diff-modal hidden';
    this.modalContainer.innerHTML = `
      <div class="ai-diff-modal-content">
        <div class="ai-diff-header">
          <h3>✨ AI 문장 수정 비교 및 검토 (gemma4:e2b)</h3>
          <button class="ai-close-btn">&times;</button>
        </div>
        <div class="ai-diff-body">
          <div class="ai-diff-col">
            <label>원본 텍스트</label>
            <div class="ai-text-box original-text"></div>
          </div>
          <div class="ai-diff-col">
            <label>AI 추천 텍스트 <span class="ai-status-badge">생성 중...</span></label>
            <div class="ai-text-box generated-text"></div>
          </div>
        </div>
        <div class="ai-diff-footer">
          <button class="ai-btn ai-btn-secondary" data-modal-action="cancel">취소</button>
          <button class="ai-btn ai-btn-secondary" data-modal-action="append">뒤에 추가</button>
          <button class="ai-btn ai-btn-primary" data-modal-action="replace">교체하여 적용</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
    document.body.appendChild(this.modalContainer);

    this.initEvents();
  }

  private initEvents() {
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.ai-btn') as HTMLButtonElement;
      if (!btn) return;

      const action = btn.dataset.action;
      if (action === 'custom') {
        const input = this.container.querySelector('.ai-inline-input') as HTMLInputElement;
        if (input && input.value.trim()) {
          this.executeAiTask('custom', input.value.trim());
        }
      } else if (action) {
        this.executeAiTask(action);
      }
    });

    const inputEl = this.container.querySelector('.ai-inline-input') as HTMLInputElement;
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && inputEl.value.trim()) {
        this.executeAiTask('custom', inputEl.value.trim());
      }
    });

    // 모달 이벤트
    this.modalContainer.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('ai-close-btn') || target.dataset.modalAction === 'cancel') {
        this.hideModal();
      } else if (target.dataset.modalAction === 'replace') {
        if (this.currentAiResponse && this.onApplyCallback) {
          this.onApplyCallback(this.currentAiResponse, 'replace');
        }
        this.hideModal();
      } else if (target.dataset.modalAction === 'append') {
        if (this.currentAiResponse && this.onApplyCallback) {
          this.onApplyCallback(this.currentAiResponse, 'append');
        }
        this.hideModal();
      }
    });
  }

  showAt(x: number, y: number, selectedText: string) {
    if (!selectedText.trim()) return;
    this.selectedText = selectedText;

    this.container.style.left = `${Math.min(x, window.innerWidth - 450)}px`;
    this.container.style.top = `${Math.max(y - 50, 10)}px`;
    this.container.classList.remove('hidden');
  }

  hide() {
    this.container.classList.add('hidden');
  }

  hideModal() {
    this.modalContainer.classList.add('hidden');
  }

  private async executeAiTask(actionType: string, customPrompt?: string) {
    this.hide();
    
    // 모달 열기
    const origBox = this.modalContainer.querySelector('.original-text') as HTMLElement;
    const genBox = this.modalContainer.querySelector('.generated-text') as HTMLElement;
    const badge = this.modalContainer.querySelector('.ai-status-badge') as HTMLElement;

    origBox.textContent = this.selectedText;
    genBox.textContent = '';
    badge.textContent = '생성 중...';
    badge.className = 'ai-status-badge loading';
    this.currentAiResponse = '';
    this.modalContainer.classList.remove('hidden');

    let systemPrompt = '당신은 한글 HWPX 문서의 맞춤법, 어휘, 문체를 다듬는 한국어 전문가 AI 어시스턴트입니다.';
    let prompt = '';

    switch (actionType) {
      case 'refine':
        prompt = `다음 텍스트를 자연스럽고 가독성 높은 한국어 문장으로 다듬어주세요. 설명 없이 개선된 문장만 출력하세요:\n\n${this.selectedText}`;
        break;
      case 'formal':
        prompt = `다음 텍스트를 정중하고 격식 있는 공문서/보고서용 문체(~함, ~임 또는 ~합니다)로 변환해주세요. 설명 없이 변환된 문장만 출력하세요:\n\n${this.selectedText}`;
        break;
      case 'summarize':
        prompt = `다음 텍스트의 핵심 내용을 명확하고 간결하게 1~2문장으로 요약해주세요. 설명 없이 요약문만 출력하세요:\n\n${this.selectedText}`;
        break;
      case 'proofread':
        prompt = `다음 텍스트의 맞춤법, 띄어쓰기, 문법 오류를 교정해주세요. 설명 없이 교정된 문장만 출력하세요:\n\n${this.selectedText}`;
        break;
      case 'custom':
        prompt = `다음 원본 텍스트:\n"${this.selectedText}"\n\n요청사항: ${customPrompt}\n\n위 요청사항을 반영하여 수정된 문장만 출력하세요.`;
        break;
    }

    try {
      const fullResponse = await this.ollamaClient.generate(prompt, {
        system: systemPrompt,
        onToken: (_chunk, full) => {
          const clean = formatMarkdownToHwpText(full);
          this.currentAiResponse = clean;
          genBox.textContent = clean;
        },
      });

      const finalClean = formatMarkdownToHwpText(fullResponse);
      this.currentAiResponse = finalClean;
      genBox.textContent = finalClean;
      badge.textContent = '생성 완료';
      badge.className = 'ai-status-badge success';
    } catch (err) {
      badge.textContent = '오류 발생';
      badge.className = 'ai-status-badge error';
      genBox.textContent = `[Ollama 연결 실패] Ollama 서비스(http://localhost:11434)가 실행 중인지 확인해주세요.\n\n오류: ${err}`;
      showToast('Ollama API 통신 실패 (gemma4:e2b)');
    }
  }
}
