/**
 * 한국 공문서 및 비즈니스 표준 서식 템플릿 & 톤앤매너 변환 엔진
 */

export interface DocTemplate {
  id: string;
  category: 'public' | 'business' | 'report' | 'tone';
  title: string;
  description: string;
  icon: string;
  systemPrompt: string;
  userPromptTemplate: string;
  skeletonMarkdown?: string;
}

export interface TonePreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  instruction: string;
}

/**
 * 1. 톤앤매너 프리셋
 */
export const KOREAN_TONE_PRESETS: TonePreset[] = [
  {
    id: 'bulleted',
    name: '개조식 정리',
    icon: 'format_list_bulleted',
    description: '문장을 명사형 종결(-함/-음/-임/-추진)과 불렛포인트로 간결화',
    instruction: '선택한 문장을 행정 보고서용 개조식(1. 가. • 등 위계형 번호 및 -함/-임/-추진 등의 명사형 종결어미)으로 정돈해 주세요.',
  },
  {
    id: 'official',
    name: '공문서 격식체',
    icon: 'verified',
    description: '행정안전부 공문서 표준 어투(~하오니 협조하여 주시기 바랍니다)',
    instruction: '선택한 문장을 공공기관 및 대외 협조 공문서 표준 격식체(정중하고 단정한 공문 어조)로 변환해 주세요.',
  },
  {
    id: 'report',
    name: '보고서 요약체',
    icon: 'analytics',
    description: '경영진 및 의사결정권자 보고용 직관적이고 군더더기 없는 문체',
    instruction: '선택한 문장을 의사결정권자 보고에 적합하도록 군더더기 없는 핵심 요약 보고서체로 작성해 주세요.',
  },
  {
    id: 'press',
    name: '대외 홍보체',
    icon: 'campaign',
    description: '보도자료, 공지사항, 사내외 홍보용 가독성 높은 친절한 문체',
    instruction: '선택한 문장을 대외 고객 및 언론 보도에 적합한 친절하고 신뢰감 있는 보도자료/홍보문체로 다듬어 주세요.',
  },
];

/**
 * 2. 한국 표준 공문서/비즈니스 서식 템플릿
 */
export const KOREAN_DOCUMENT_TEMPLATES: DocTemplate[] = [
  {
    id: 'gianmun',
    category: 'public',
    title: '기안문 (행안부 표준)',
    description: '행정안전부 공문서 규격에 맞춘 표준 기안문 서식',
    icon: 'article',
    systemPrompt: '당신은 대한민국 행정 공문서 작성 전문가입니다. 행정안전부 공문서 작성 표준 규격에 맞추어 항목을 구분하고 단정하게 작성하세요.',
    userPromptTemplate: '주제: [주제 입력]\n\n위 주제로 행정 표준 기안문(추진 배경, 주요 내용, 세부 계획, 행정 사항, 기대 효과)을 작성해 주세요.',
    skeletonMarkdown: `## 1. 추진 목적 및 배경
• 관련 근거 및 추진 필요성 기술
• 현황 및 문제점 분석

## 2. 주요 사업(추진) 내용
• 사업 개요 및 세부 실행 계획
• 추진 일정 및 담당 부서

## 3. 소요 예산 및 집행 계획
• 예산 과목 및 총 소요 금액
• 세부 산출 내역

## 4. 행정 사항 및 기대 효과
• 부서 간 협조 요청 사항
• 사업 추진에 따른 기대 효과`,
  },
  {
    id: 'pumui',
    category: 'business',
    title: '품의서 (예산/구매 집행)',
    description: '물품 구매, 용역 발주, 예산 지출 승인을 위한 품의서',
    icon: 'shopping_cart',
    systemPrompt: '당신은 기업 경영지원 및 예산 관리 전문가입니다. 지출 사유의 타당성과 예산 산출 근거가 명확한 표준 품의서를 작성하세요.',
    userPromptTemplate: '품의 건명: [건명 입력]\n지출 목적: [목적 입력]\n\n위 내용으로 소요 예산표가 포함된 지출 품의서를 작성해 주세요.',
    skeletonMarkdown: `## 1. 품의 목적
• 건명: 
• 사유 및 필요성: 

## 2. 구매/집행 세부 내역
| 품목/항목 | 규격/수량 | 단가(원) | 금액(원) | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| 품목 A | 1식 | 0 | 0 | - |

## 3. 집행 일정 및 납품 조건
• 집행 예정일: 
• 납품 및 검수 기한: 

## 4. 기대 효과
• 비용 절감 및 업무 효율 향상 효과`,
  },
  {
    id: 'cooperation',
    category: 'public',
    title: '업무 협조 공문',
    description: '부서 간 또는 대외 기관 간 협조 요청 공문',
    icon: 'handshake',
    systemPrompt: '당신은 공공 및 기업 대외 소통 전문가입니다. 정중하면서도 요청 사항과 기한이 명확한 협조 공문을 작성하세요.',
    userPromptTemplate: '협조 요청 대상: [수신 부서/기관]\n요청 사항: [세부 내용]\n회신 기한: [기한]\n\n위 내용으로 업무 협조 공문을 작성해 주세요.',
    skeletonMarkdown: `## 1. 귀 부서(기관)의 무궁한 발전을 기원합니다.

## 2. 추진 배경
• 관련 근거: 
• 협조 필요성: 

## 3. 협조 요청 사항
• 요청 내용: 
• 제출(회신) 기한: 
• 제출 방법: 

## 4. 문의 및 담당자
• 담당 부서: 
• 담당자 및 연락처: `,
  },
  {
    id: 'weekly_report',
    category: 'report',
    title: '주간 업무 보고',
    description: '금주 실적과 차주 계획을 명확히 전달하는 주간 보고서',
    icon: 'event_note',
    systemPrompt: '당신은 비즈니스 전략 기획 전문가입니다. 실적과 향후 계획을 개조식으로 명확히 구분하여 작성하세요.',
    userPromptTemplate: '부서/작성자: [부서명/이름]\n금주 주요 업무: [실적 요약]\n차주 계획: [계획 요약]\n\n위 내용으로 깔끔한 주간 업무 보고서를 작성해 주세요.',
    skeletonMarkdown: `## 1. 금주 주요 업무 실적 (Done)
• [과제 A] 목표 대비 진척 현황 및 완료 사항
• [과제 B] 부서 간 협업 및 주요 성과

## 2. 차주 업무 추진 계획 (Plan)
• [과제 A] 세부 실행 과제 및 마일스톤
• [과제 C] 신규 착수 과제 준비 사항

## 3. 주요 이슈 및 애로사항 (Issue & Risk)
• 당면 과제 및 리스크 요인
• 해결 방안 및 지원 요청 사항`,
  },
  {
    id: 'meeting_minutes',
    category: 'report',
    title: '회의록 (표준 서식)',
    description: '안건, 결정 사항, 향후 Action Item 중심의 회의록',
    icon: 'groups',
    systemPrompt: '당신은 효율적인 회의 관리 전문가입니다. 회의의 핵심 논의, 결정 사항, 담당자별 Action Item을 구조화하여 정리하세요.',
    userPromptTemplate: '회의 안건: [안건]\n참석자: [참석자]\n주요 논의 내용: [내용]\n\n위 내용으로 표준 회의록을 작성해 주세요.',
    skeletonMarkdown: `## 1. 회의 개요
• 일시: 
• 장소: 
• 참석자: 
• 안건: 

## 2. 주요 논의 및 결정 사항
• [안건 1] 논의 배경 및 최종 결정 사항
• [안건 2] 의견 조율 결과

## 3. 향후 조치 계획 (Action Items)
| 조치 사항 | 담당자 | 완료 목표일 | 비고 |
| :--- | :--- | :--- | :--- |
| 세부 계획 수립 | 담당자 | 2026.00.00 | 진행 중 |`,
  },
  {
    id: 'press_release',
    category: 'public',
    title: '보도자료 (홍보 표준)',
    description: '언론 배포용 표준 보도자료 양식',
    icon: 'campaign',
    systemPrompt: '당신은 언론 홍보 및 PR 전문가입니다. 헤드라인(제목), 리드문, 상세 본문, 관계자 인용구(Quote)를 포함한 완성도 높은 보도자료를 작성하세요.',
    userPromptTemplate: '보도 주제: [주제 입력]\n핵심 성과/발표 내용: [내용 입력]\n\n위 내용으로 배포용 공식 보도자료를 작성해 주세요.',
    skeletonMarkdown: `## [보도자료] 제목을 입력하세요 (간결하고 임팩트 있는 헤드라인)
### - 부제목: 핵심 성과 및 의미를 1~2줄로 요약

**[배포일시: 即時 배포 가능]**

[리드문] 회사는 어떤 성과/신제품을 발표하며, 이는 어떤 의미를 갖는다는 핵심 내용을 서두에 제시한다.

## 1. 주요 내용 및 특장점
• 세부 혁신 기술 및 주요 혜택 기술
• 시장 내 차별화 요소 및 기대 성과

## 2. 관계자 코멘트
> "이번 성과를 통해 사용자들에게 차별화된 가치를 제공할 것이며, 앞으로도 혁신을 지속하겠다"고 회사 관계자는 밝혔다.

## 3. 문의처 (언론 담당)
• 홍보팀 담당자: 성명 (전화번호 / 이메일)`,
  },
];

/**
 * ID로 템플릿 검색
 */
export function getTemplateById(id: string): DocTemplate | undefined {
  return KOREAN_DOCUMENT_TEMPLATES.find(t => t.id === id);
}

/**
 * ID로 톤 프리셋 검색
 */
export function getTonePresetById(id: string): TonePreset | undefined {
  return KOREAN_TONE_PRESETS.find(p => p.id === id);
}
