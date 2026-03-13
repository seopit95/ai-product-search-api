type HistoryItem = {
  role?: string;
  content?: string;
};

type CounselState = {
  followUpCount?: number;
  primaryNeeds?: string[];
  secondaryNeeds?: string[];
  goals?: string[];
  constraints?: string[];
  askedTopics?: string[];
  summary?: string;
  readyForRecommendation?: boolean;
  lastFollowUpQuestion?: string | null;
  filters?: Record<string, unknown>;
};

// 프롬프트에 넣는 대화는 최신 흐름만 짧게 유지해서 LLM이 핵심 문맥만 보게 한다.
function FnFormatHistory(history: HistoryItem[] = []): string {
  if (!Array.isArray(history) || !history.length) {
    return '없음';
  }

  return history
    .slice(-6)
    .map((item) => `${item.role || 'unknown'}: ${item.content || ''}`.trim())
    .filter(Boolean)
    .join('\n');
}

// 상품 전체 payload를 그대로 넣지 않고, 상담 판단에 필요한 필드만 추려 프롬프트 토큰을 줄인다.
function FnCompactCandidate(candidate: any) {
  const payload = candidate?.payload || {};

  return {
    id: String(candidate?.id ?? payload.goods_no ?? payload.name ?? ''),
    name: payload.name || '',
    brand: payload.brand || '',
    category: payload.category || '',
    price: payload.price ?? null,
    description: payload.description || '',
    primary_ingredient: payload.primary_ingredient || '',
    effects_summary: payload.effects_summary || '',
    secondary_benefits: Array.isArray(payload.secondary_benefits) ? payload.secondary_benefits : [],
    recommended_for: Array.isArray(payload.recommended_for) ? payload.recommended_for : [],
    notes: payload.notes || '',
    score: typeof candidate?.score === 'number' ? candidate.score : null,
  };
}

// 각 턴에서 "무엇을 더 물을지"와 "이제 추천해도 되는지"를 구조화해서 받는 프롬프트다.
export function FnBuildCounselTurnPrompt(params: {
  userMessage: string;
  counsel: CounselState;
  history?: HistoryItem[];
  remainingQuestions: number;
}): string {
  return `
너는 영양제 쇼핑몰의 전문 영양상담사다.

역할:
- 사용자의 증상과 목적을 상담형으로 파악한다.
- 한 번에 하나의 추가 질문만 한다.
- 최대 ${params.remainingQuestions}번 더 질문할 수 있다고 가정한다.
- 설명은 일반인이 이해할 생활 맥락 중심으로 짧게 한다.
- 아직 정보가 부족하면 상품 추천으로 바로 넘어가지 않는다.

반드시 아래 JSON만 출력해라.
{
  "primaryNeeds": string[],
  "secondaryNeeds": string[],
  "goals": string[],
  "constraints": string[],
  "filters": {
    "max_price": number | null,
    "min_price": number | null,
    "brand": string | null,
    "category": string | null
  },
  "summary": string,
  "briefExplanation": string,
  "followUpQuestion": string | null,
  "followUpTopic": string | null,
  "readyForRecommendation": boolean
}

규칙:
- primaryNeeds에는 핵심 니즈를 넣는다. 예: 피로, 눈 피로, 소화 불편
- secondaryNeeds에는 동반 니즈를 넣는다
- goals에는 개선, 예방, 회복, 유지 같은 목적을 넣는다
- constraints에는 복용 제약이나 주의사항을 넣는다
- summary는 현재까지 파악된 내용을 한두 문장으로 요약한다
- briefExplanation은 1~2문장으로 짧게 쓴다
- followUpQuestion은 정말 필요한 질문 1개만 넣고, 추천이 가능하면 null
- readyForRecommendation=true 이면 followUpQuestion은 null로 둔다
- 사용자가 바로 추천을 원해도 정보가 너무 부족하면 가장 중요한 질문 1개를 먼저 한다
- 남은 질문 수가 0이면 readyForRecommendation=true로 판단한다

현재 상담 상태:
${JSON.stringify(params.counsel, null, 2)}

최근 대화:
${FnFormatHistory(params.history)}

사용자 메시지:
${params.userMessage}
`.trim();
}

// 검색 결과를 상담 요약과 다시 대조해 최종 추천 후보와 추천 이유를 고르는 프롬프트다.
export function FnBuildRecommendationReviewPrompt(params: {
  counselSummary: string;
  candidates: any[];
}): string {
  return `
너는 영양제 추천 결과 검수자다.

역할:
- 상담 요약에 직접 맞는 상품만 남긴다
- 각 상품마다 왜 맞는지 짧은 추천 이유를 만든다
- 애매하거나 억지로 연결되는 상품은 제외한다

반드시 아래 JSON만 출력해라.
{
  "selectedProducts": [
    {
      "productId": string,
      "reason": string
    }
  ]
}

규칙:
- productId는 아래 후보의 id 값만 사용한다
- 최대 3개만 선택한다
- reason은 한 문장으로 짧게 쓴다

상담 요약:
${params.counselSummary}

상품 후보:
${JSON.stringify(params.candidates.map(FnCompactCandidate), null, 2)}
`.trim();
}

// 최종 노출 직전, 상담 내용을 사용자가 읽기 쉬운 짧은 말풍선 텍스트로 정리하는 프롬프트다.
export function FnBuildRecommendationAnswerPrompt(params: {
  counselSummary: string;
  products: Array<{ name: string; reason: string }>;
}): string {
  return `
너는 영양제 쇼핑몰의 전문 상담사다.

역할:
- 지금까지 상담한 내용을 짧게 종합한다
- 왜 이런 제품군이 맞는지 자연스럽게 설명한다
- 곧바로 아래 제품을 보게 되는 흐름으로 마무리한다

출력 규칙:
- 본문만 출력
- 마크다운 금지
- 1~3개의 짧은 단락으로 쓴다
- 단락 사이는 빈 줄로 구분한다
- 각 단락은 1~2문장
- 장문 설명 금지

상담 요약:
${params.counselSummary}

선정 상품과 이유:
${JSON.stringify(params.products, null, 2)}
`.trim();
}
