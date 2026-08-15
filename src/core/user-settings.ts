/**
 * 사용자 환경설정 저장/로드 서비스
 *
 * localStorage 기반, 단일 키(rhwp-settings)에 JSON으로 저장.
 * 섹션별 확장 가능한 구조.
 */

/** 대표 글꼴 세트 (7개 언어별 글꼴) */
export interface FontSet {
  name: string;
  korean: string;
  english: string;
  chinese: string;
  japanese: string;
  other: string;
  symbol: string;
  user: string;
}

/** 글꼴 환경 설정 */
export interface FontSettings {
  /** 사용자 정의 대표 글꼴 세트 */
  fontSets: FontSet[];
  /** 최근 사용 글꼴 표시 여부 */
  showRecentFonts: boolean;
  /** 최근 사용 글꼴 표시 개수 (1~5) */
  recentFontCount: number;
}

/** 앱 UI 테마 설정값 */
export type ThemeMode = 'system' | 'light' | 'dark';

/** 앱 UI 테마 설정 */
export interface ThemeSettings {
  /** 사용자가 선택한 테마 모드 */
  mode: ThemeMode;
}

/** 대화상자 UI 설정 */
export interface DialogSettings {
  /** 개체 속성 기본 탭에서 너비/높이 입력 비율을 유지할지 여부 */
  picturePropsKeepRatio: boolean;
  /** PDF 저장 전에 브라우저 인쇄 대상 선택 방법을 안내할지 여부 */
  showPdfPrintGuidance: boolean;
}

/** 보기 표시 설정 */
export interface ViewSettings {
  /** 문단부호 표시 여부 */
  showParagraphMarks: boolean;
  /** 조판부호 표시 여부 */
  showControlCodes: boolean;
  /** 짤림보기(잘림 보기) 켜짐 여부. true = 편집용지 경계 밖 오버플로 내용을 보임(잘림 미적용). */
  clipView: boolean;
}

/** 복구용 자동저장 설정 */
export interface AutosaveSettings {
  /** 복구용 자동저장 사용 여부 */
  recoveryEnabled: boolean;
  /** 복구용 자동저장 간격(분) */
  recoveryIntervalMinutes: number;
  /** 입력이 멈췄을 때 자동저장 사용 여부 */
  idleSaveEnabled: boolean;
  /** 입력이 멈춘 뒤 자동저장까지 기다릴 시간(초) */
  idleDelaySeconds: number;
}

/** 프롬프트 템플릿 항목 */
export interface PromptTemplate {
  label: string;
  icon: string;
  prompt: string;
}

/** AI Assister 환경 설정 */
export interface AiSettings {
  /** Ollama 서버 주소 (기본: http://localhost:11434) */
  ollamaBaseUrl: string;
  /** 기본 LLM 모델명 (기본: gemma4:e2b) */
  defaultModel: string;
  /** 문서 컨텍스트 최대 문자수 (기본: 8000) */
  contextMaxChars: number;
  /** AI 응답 temperature (기본: 0.7) */
  temperature: number;
  /** 사용자 정의 시스템 프롬프트 (빈 문자열이면 기본 프롬프트 사용) */
  customSystemPrompt: string;
  /** 사용자 정의 프롬프트 템플릿 */
  promptTemplates: PromptTemplate[];
}

/** 전체 설정 구조 */
export interface AppSettings {
  version: number;
  font: FontSettings;
  theme: ThemeSettings;
  dialog: DialogSettings;
  view: ViewSettings;
  autosave: AutosaveSettings;
  ai: AiSettings;
}

/** 언어 인덱스 상수 (HWP 7개 언어) */
export const LANG = {
  KOREAN: 0,
  ENGLISH: 1,
  CHINESE: 2,
  JAPANESE: 3,
  OTHER: 4,
  SYMBOL: 5,
  USER: 6,
} as const;

/** 언어 인덱스 → 한국어 라벨 */
export const LANG_LABELS = ['한글', '영문', '한자', '일어', '외국어', '기호', '사용자'] as const;

/** 언어 인덱스 → FontSet 키 매핑 */
const LANG_KEYS: (keyof Omit<FontSet, 'name'>)[] = [
  'korean', 'english', 'chinese', 'japanese', 'other', 'symbol', 'user',
];

/** 내장 기본 대표 글꼴 (편집/삭제 불가) */
export const BUILTIN_FONT_SETS: readonly FontSet[] = [
  {
    name: '함초롬',
    korean: '함초롬바탕', english: '함초롬바탕', chinese: '함초롬바탕',
    japanese: '함초롬바탕', other: '함초롬바탕', symbol: '함초롬바탕', user: '함초롬바탕',
  },
  {
    name: '함초롬돋움',
    korean: '함초롬돋움', english: '함초롬돋움', chinese: '함초롬돋움',
    japanese: '함초롬돋움', other: '함초롬돋움', symbol: '함초롬돋움', user: '함초롬돋움',
  },
  {
    name: '맑은 고딕',
    korean: '맑은 고딕', english: '맑은 고딕', chinese: '맑은 고딕',
    japanese: '맑은 고딕', other: '맑은 고딕', symbol: '맑은 고딕', user: '맑은 고딕',
  },
  {
    name: '바탕',
    korean: '바탕', english: '바탕', chinese: '바탕',
    japanese: '바탕', other: '바탕', symbol: '바탕', user: '바탕',
  },
];

const STORAGE_KEY = 'rhwp-settings';

function defaultSettings(): AppSettings {
  return {
    version: 1,
    font: {
      fontSets: [],
      showRecentFonts: true,
      recentFontCount: 3,
    },
    theme: {
      mode: 'system',
    },
    dialog: {
      picturePropsKeepRatio: true,
      showPdfPrintGuidance: true,
    },
    view: {
      showParagraphMarks: false,
      showControlCodes: false,
      clipView: true,
    },
    autosave: {
      recoveryEnabled: true,
      recoveryIntervalMinutes: 10,
      idleSaveEnabled: true,
      idleDelaySeconds: 10,
    },
    ai: {
      ollamaBaseUrl: 'http://localhost:11434',
      defaultModel: 'gemma4:e2b',
      contextMaxChars: 8000,
      temperature: 0.7,
      customSystemPrompt: '',
      promptTemplates: [
        { label: '기안문 작성', icon: 'article', prompt: '행정 표준 기안문(추진목적, 주요내용, 세부계획, 기대효과) 작성: ' },
        { label: '품의서 작성', icon: 'shopping_cart', prompt: '지출 품의서(목적, 소요예산표, 집행계획) 작성: ' },
        { label: '개조식 정리', icon: 'format_list_bulleted', prompt: '보고서용 개조식(-함/-임 및 불렛포인트) 변환: ' },
        { label: '공문서 격식체', icon: 'verified', prompt: '공문서 표준 격식체 변환: ' },
        { label: '보고서 요약', icon: 'analytics', prompt: '의사결정권자 보고용 핵심 요약: ' },
        { label: '주간업무보고', icon: 'event_note', prompt: '주간 업무 보고서(금주 실적, 차주 계획, 이슈) 작성: ' },
        { label: '보도자료', icon: 'campaign', prompt: '배포용 공식 보도자료 작성: ' },
        { label: '결론/시사점', icon: 'track_changes', prompt: '결론 및 향후 시사점 도출: ' },
      ],
    },
  };
}

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/** 사용자 환경설정 서비스 (싱글턴) */
class UserSettingsService {
  private data: AppSettings;

  constructor() {
    this.data = this.load();
  }

  private load(): AppSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSettings();
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      // 기본값 병합
      const defaults = defaultSettings();
      const dialog: Partial<DialogSettings> = parsed.dialog ?? {};
      const view: Partial<ViewSettings> = parsed.view ?? {};
      const autosave: Partial<AutosaveSettings> = parsed.autosave ?? {};
      const ai: Partial<AiSettings> = parsed.ai ?? {};
      return {
        version: parsed.version ?? defaults.version,
        font: {
          ...defaults.font,
          ...(parsed.font ?? {}),
        },
        theme: {
          ...defaults.theme,
          ...(parsed.theme ?? {}),
          mode: normalizeThemeMode(parsed.theme?.mode),
        },
        dialog: {
          ...defaults.dialog,
          ...dialog,
          picturePropsKeepRatio: normalizeBoolean(
            dialog.picturePropsKeepRatio,
            defaults.dialog.picturePropsKeepRatio,
          ),
          showPdfPrintGuidance: normalizeBoolean(
            dialog.showPdfPrintGuidance,
            defaults.dialog.showPdfPrintGuidance,
          ),
        },
        view: {
          ...defaults.view,
          ...view,
          showParagraphMarks: normalizeBoolean(
            view.showParagraphMarks,
            defaults.view.showParagraphMarks,
          ),
          showControlCodes: normalizeBoolean(
            view.showControlCodes,
            defaults.view.showControlCodes,
          ),
          clipView: normalizeBoolean(
            view.clipView,
            defaults.view.clipView,
          ),
        },
        autosave: {
          ...defaults.autosave,
          ...autosave,
          recoveryEnabled: normalizeBoolean(
            autosave.recoveryEnabled,
            defaults.autosave.recoveryEnabled,
          ),
          recoveryIntervalMinutes: normalizeNumber(
            autosave.recoveryIntervalMinutes,
            defaults.autosave.recoveryIntervalMinutes,
            1,
            120,
          ),
          idleSaveEnabled: normalizeBoolean(
            autosave.idleSaveEnabled,
            defaults.autosave.idleSaveEnabled,
          ),
          idleDelaySeconds: normalizeNumber(
            autosave.idleDelaySeconds,
            defaults.autosave.idleDelaySeconds,
            5,
            600,
          ),
        },
        ai: {
          ...defaults.ai,
          ...ai,
          ollamaBaseUrl: normalizeString(ai.ollamaBaseUrl, defaults.ai.ollamaBaseUrl),
          defaultModel: normalizeString(ai.defaultModel, defaults.ai.defaultModel),
          contextMaxChars: normalizeNumber(ai.contextMaxChars, defaults.ai.contextMaxChars, 1000, 100000),
          temperature: typeof ai.temperature === 'number' && Number.isFinite(ai.temperature)
            ? Math.max(0, Math.min(2, ai.temperature))
            : defaults.ai.temperature,
          customSystemPrompt: typeof ai.customSystemPrompt === 'string' ? ai.customSystemPrompt : defaults.ai.customSystemPrompt,
          promptTemplates: Array.isArray(ai.promptTemplates) && ai.promptTemplates.length > 0
            ? ai.promptTemplates
            : defaults.ai.promptTemplates,
        },
      };
    } catch {
      return defaultSettings();
    }
  }

  save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  /** 전체 설정 반환 */
  getAll(): AppSettings {
    return this.data;
  }

  /** 글꼴 설정 반환 */
  getFontSettings(): FontSettings {
    return this.data.font;
  }

  /** 글꼴 설정 업데이트 */
  updateFontSettings(partial: Partial<FontSettings>): void {
    Object.assign(this.data.font, partial);
    this.save();
  }

  /** 테마 설정 반환 */
  getThemeSettings(): ThemeSettings {
    return this.data.theme;
  }

  /** 테마 모드 설정 */
  setThemeMode(mode: ThemeMode): void {
    this.data.theme.mode = normalizeThemeMode(mode);
    this.save();
  }

  /** 대화상자 UI 설정 반환 */
  getDialogSettings(): DialogSettings {
    return this.data.dialog;
  }

  /** 개체 속성 기본 탭 비율 유지 설정 반환 */
  getPicturePropsKeepRatio(): boolean {
    return this.data.dialog.picturePropsKeepRatio;
  }

  /** 개체 속성 기본 탭 비율 유지 설정 */
  setPicturePropsKeepRatio(value: boolean): void {
    this.data.dialog.picturePropsKeepRatio = value;
    this.save();
  }

  /** PDF 저장 전 브라우저 인쇄 대상 안내 표시 설정 반환 */
  getShowPdfPrintGuidance(): boolean {
    return this.data.dialog.showPdfPrintGuidance;
  }

  /** PDF 저장 전 브라우저 인쇄 대상 안내 표시 설정 */
  setShowPdfPrintGuidance(value: boolean): void {
    this.data.dialog.showPdfPrintGuidance = value;
    this.save();
  }

  /** 보기 표시 설정 반환 */
  getViewSettings(): ViewSettings {
    return this.data.view;
  }

  /** 문단부호 표시 설정 */
  setShowParagraphMarks(value: boolean): void {
    this.data.view.showParagraphMarks = value;
    this.save();
  }

  /** 조판부호 표시 설정 */
  setShowControlCodes(value: boolean): void {
    this.data.view.showControlCodes = value;
    this.save();
  }

  /** 짤림보기(잘림 보기) 켜짐 설정. true = 오버플로 내용 표시(잘림 미적용). */
  setClipView(value: boolean): void {
    this.data.view.clipView = value;
    this.save();
  }

  /** 복구용 자동저장 설정 반환 */
  getAutosaveSettings(): AutosaveSettings {
    return this.data.autosave;
  }

  /** 복구용 자동저장 설정 */
  updateAutosaveSettings(partial: Partial<AutosaveSettings>): void {
    this.data.autosave = {
      ...this.data.autosave,
      ...partial,
      recoveryEnabled: normalizeBoolean(
        partial.recoveryEnabled,
        this.data.autosave.recoveryEnabled,
      ),
      recoveryIntervalMinutes: normalizeNumber(
        partial.recoveryIntervalMinutes,
        this.data.autosave.recoveryIntervalMinutes,
        1,
        120,
      ),
      idleSaveEnabled: normalizeBoolean(
        partial.idleSaveEnabled,
        this.data.autosave.idleSaveEnabled,
      ),
      idleDelaySeconds: normalizeNumber(
        partial.idleDelaySeconds,
        this.data.autosave.idleDelaySeconds,
        5,
        600,
      ),
    };
    this.save();
  }

  /** AI Assister 설정 반환 */
  getAi(): AiSettings {
    return this.data.ai;
  }

  /** AI Assister 설정 업데이트 */
  updateAiSettings(partial: Partial<AiSettings>): void {
    this.data.ai = {
      ...this.data.ai,
      ...partial,
      ollamaBaseUrl: partial.ollamaBaseUrl !== undefined
        ? normalizeString(partial.ollamaBaseUrl, this.data.ai.ollamaBaseUrl)
        : this.data.ai.ollamaBaseUrl,
      defaultModel: partial.defaultModel !== undefined
        ? normalizeString(partial.defaultModel, this.data.ai.defaultModel)
        : this.data.ai.defaultModel,
      contextMaxChars: partial.contextMaxChars !== undefined
        ? normalizeNumber(partial.contextMaxChars, this.data.ai.contextMaxChars, 1000, 100000)
        : this.data.ai.contextMaxChars,
      temperature: typeof partial.temperature === 'number' && Number.isFinite(partial.temperature)
        ? Math.max(0, Math.min(2, partial.temperature))
        : this.data.ai.temperature,
      customSystemPrompt: partial.customSystemPrompt !== undefined
        ? partial.customSystemPrompt
        : this.data.ai.customSystemPrompt,
      promptTemplates: Array.isArray(partial.promptTemplates)
        ? partial.promptTemplates
        : this.data.ai.promptTemplates,
    };
    this.save();
  }

  /** 모든 대표 글꼴 세트 반환 (내장 + 사용자) */
  getAllFontSets(): FontSet[] {
    return [...BUILTIN_FONT_SETS, ...this.data.font.fontSets];
  }

  /** 사용자 정의 대표 글꼴 세트만 반환 */
  getUserFontSets(): FontSet[] {
    return this.data.font.fontSets;
  }

  /** 대표 글꼴 세트 추가 */
  addFontSet(fs: FontSet): boolean {
    const allNames = this.getAllFontSets().map(s => s.name);
    if (allNames.includes(fs.name)) return false; // 중복 이름 불가
    this.data.font.fontSets.push(fs);
    this.save();
    return true;
  }

  /** 대표 글꼴 세트 수정 (사용자 정의만) */
  updateFontSet(index: number, fs: FontSet): boolean {
    if (index < 0 || index >= this.data.font.fontSets.length) return false;
    this.data.font.fontSets[index] = fs;
    this.save();
    return true;
  }

  /** 대표 글꼴 세트 삭제 (사용자 정의만) */
  removeFontSet(index: number): boolean {
    if (index < 0 || index >= this.data.font.fontSets.length) return false;
    this.data.font.fontSets.splice(index, 1);
    this.save();
    return true;
  }

  /** FontSet의 언어 인덱스로 글꼴 이름 조회 */
  static getFontByLang(fs: FontSet, langIndex: number): string {
    return fs[LANG_KEYS[langIndex] ?? 'korean'] ?? fs.korean;
  }

  /** FontSet에 언어 인덱스로 글꼴 이름 설정 */
  static setFontByLang(fs: FontSet, langIndex: number, fontName: string): void {
    const key = LANG_KEYS[langIndex];
    if (key) (fs as any)[key] = fontName;
  }
}

/** 싱글턴 인스턴스 */
export const userSettings = new UserSettingsService();
