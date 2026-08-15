/**
 * AI 오류 발생 시 사용자 친화적인 안내 카드 렌더러
 */

export interface AiErrorInfo {
  type: 'connection' | 'model_not_found' | 'timeout' | 'unknown';
  title: string;
  message: string;
  suggestion: string;
  commandHint?: string;
  retryAction?: () => void;
}

export function classifyAiError(err: unknown, currentModel: string = 'gemma4:e2b', baseUrl: string = 'http://localhost:11434'): AiErrorInfo {
  const errMsg = String(err);

  if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('ECONNREFUSED') || errMsg.includes('연결 실패')) {
    return {
      type: 'connection',
      title: '로컬 Ollama 서비스 연결 불가',
      message: `로컬 AI 서버(${baseUrl})에 연결할 수 없습니다.`,
      suggestion: 'PC에 Ollama가 설치되어 실행 중인지 확인해 주세요.',
      commandHint: '터미널에서 ollama serve 실행',
    };
  }

  if (errMsg.includes('404') || errMsg.includes('model not found') || errMsg.includes('확인 실패')) {
    return {
      type: 'model_not_found',
      title: `'${currentModel}' 모델 미설치`,
      message: `지정된 LLM 모델(${currentModel})을 Ollama에서 찾을 수 없습니다.`,
      suggestion: '터미널에서 해당 모델을 다운로드하거나 다른 설치된 모델을 선택해 주세요.',
      commandHint: `ollama pull ${currentModel}`,
    };
  }

  if (errMsg.includes('timeout') || errMsg.includes('timed out') || errMsg.includes('시간 초과')) {
    return {
      type: 'timeout',
      title: 'AI 응답 시간 초과',
      message: '문서의 분량이 너무 크거나 모델 추론에 오랜 시간이 소요되었습니다.',
      suggestion: '선택 영역을 줄이거나 컨텍스트 길이 슬라이더(예: 4k~8k)를 조절해 보세요.',
    };
  }

  return {
    type: 'unknown',
    title: 'AI 요청 처리 중 오류 발생',
    message: errMsg.replace(/^Error:\s*/, ''),
    suggestion: '일시적인 오류일 수 있습니다. 잠시 후 다시 시도해 주세요.',
  };
}

export function renderAiErrorCard(info: AiErrorInfo, onRetry?: () => void): HTMLElement {
  const card = document.createElement('div');
  card.className = `ai-error-card ai-error-${info.type}`;

  const iconName = info.type === 'connection' ? 'cloud_off' : info.type === 'model_not_found' ? 'extension_off' : 'error_outline';

  card.innerHTML = `
    <div class="ai-error-header">
      <span class="mi mi-sm ai-error-icon">${iconName}</span>
      <strong>${info.title}</strong>
    </div>
    <p class="ai-error-desc">${info.message}</p>
    <div class="ai-error-tip">
      <span class="mi mi-xs">lightbulb</span> ${info.suggestion}
    </div>
    ${info.commandHint ? `
      <div class="ai-error-code-wrap">
        <code>${info.commandHint}</code>
        <button class="ai-btn-copy-code" title="명령어 복사"><span class="mi mi-xs">content_copy</span></button>
      </div>
    ` : ''}
    ${onRetry ? `
      <div class="ai-error-actions">
        <button class="ai-btn ai-btn-sm ai-btn-primary ai-btn-retry"><span class="mi mi-xs">refresh</span> 다시 시도</button>
      </div>
    ` : ''}
  `;

  if (info.commandHint) {
    const copyBtn = card.querySelector('.ai-btn-copy-code');
    copyBtn?.addEventListener('click', () => {
      navigator.clipboard.writeText(info.commandHint || '');
      copyBtn.innerHTML = '<span class="mi mi-xs">check</span>';
      setTimeout(() => {
        copyBtn.innerHTML = '<span class="mi mi-xs">content_copy</span>';
      }, 1500);
    });
  }

  if (onRetry) {
    const retryBtn = card.querySelector('.ai-btn-retry');
    retryBtn?.addEventListener('click', onRetry);
  }

  return card;
}
