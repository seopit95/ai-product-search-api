import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import { qdrant } from '../lib/qdrant';
import { buildChatQueryText, SearchFilters } from '../lib/search-text';
import { buildSparseVector } from '../lib/sparse-vector';
import {
  FnBuildCounselTurnPrompt,
  FnBuildRecommendationAnswerPrompt,
  FnBuildRecommendationReviewPrompt,
} from './chat.prompts';

const MAX_FOLLOW_UP_QUESTIONS = 3;
const QDRANT_PREFETCH_LIMIT = 60;
const QDRANT_CANDIDATE_LIMIT = 12;
const QDRANT_SCORE_THRESHOLD = 0.18;

type HistoryEntry = {
  role: string;
  content: string;
  ts: string;
};

type CounselFilters = SearchFilters & {
  max_price: number | null;
  min_price: number | null;
  brand: string | null;
  category: string | null;
};

type CounselState = {
  followUpCount: number;
  primaryNeeds: string[];
  secondaryNeeds: string[];
  goals: string[];
  constraints: string[];
  askedTopics: string[];
  summary: string;
  readyForRecommendation: boolean;
  lastFollowUpQuestion: string | null;
  filters: CounselFilters;
};

type SessionState = {
  history: HistoryEntry[];
  lastResults: any[];
  counsel: CounselState;
};

type CounselTurnResult = {
  primaryNeeds: string[];
  secondaryNeeds: string[];
  goals: string[];
  constraints: string[];
  filters: CounselFilters;
  summary: string;
  briefExplanation: string;
  followUpQuestion: string | null;
  followUpTopic: string | null;
  readyForRecommendation: boolean;
};

type RecommendationSelection = {
  selectedProducts: Array<{
    productId: string;
    reason: string;
  }>;
};

@Injectable()
export class ChatService {
  private readonly client: OpenAI;
  private readonly sessionStore = new Map<string, SessionState>();

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  // 상담 세션을 시작할 때 항상 같은 형태의 필터 상태를 쓰도록 기본값을 만든다.
  private FnBuildEmptyFilters(): CounselFilters {
    return {
      max_price: null,
      min_price: null,
      brand: null,
      category: null,
    };
  }

  // 한 세션에서 누적될 상담 메모의 초기 상태다.
  private FnBuildEmptyCounselState(): CounselState {
    return {
      followUpCount: 0,
      primaryNeeds: [],
      secondaryNeeds: [],
      goals: [],
      constraints: [],
      askedTopics: [],
      summary: '',
      readyForRecommendation: false,
      lastFollowUpQuestion: null,
      filters: this.FnBuildEmptyFilters(),
    };
  }

  // 세션이 없으면 새 상담 세션을 만들고, 있으면 기존 상담 흐름을 이어서 쓴다.
  private FnGetSession(sessionId?: string): SessionState | null {
    if (!sessionId) return null;

    if (!this.sessionStore.has(sessionId)) {
      this.sessionStore.set(sessionId, {
        history: [],
        lastResults: [],
        counsel: this.FnBuildEmptyCounselState(),
      });
    }

    return this.sessionStore.get(sessionId) || null;
  }

  // 최근 대화 일부만 유지해서 LLM이 직전 문맥만 참고하게 만든다.
  private FnPushHistory(session: SessionState | null, role: string, content: string): void {
    if (!session || !content) return;

    session.history.push({ role, content, ts: new Date().toISOString() });
    if (session.history.length > 20) {
      session.history = session.history.slice(-20);
    }
  }

  // 프롬프트에는 너무 긴 대화 전체 대신 최근 대화만 넣는다.
  private FnGetRecentHistory(session: SessionState | null): HistoryEntry[] {
    if (!session) return [];
    return session.history.slice(-6);
  }

  // LLM이 JSON 앞뒤에 잡텍스트를 섞어도 최대한 안전하게 JSON 본문만 꺼낸다.
  private FnParseJsonText(raw: string): any {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return {};

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      const matched = trimmed.match(/\{[\s\S]*\}/);
      if (!matched) {
        throw error;
      }

      return JSON.parse(matched[0]);
    }
  }

  // 상담 메모에는 중복된 키워드가 많아지기 쉬워서 여기서 한 번 정리한다.
  private FnUnique(values: string[]): string[] {
    return Array.from(new Set(values.map((item) => String(item || '').trim()).filter(Boolean)));
  }

  // 가격/브랜드/카테고리 필터를 항상 같은 타입으로 맞춘다.
  private FnNormalizeFilters(filters?: Partial<CounselFilters>): CounselFilters {
    return {
      max_price: typeof filters?.max_price === 'number' ? filters.max_price : null,
      min_price: typeof filters?.min_price === 'number' ? filters.min_price : null,
      brand: typeof filters?.brand === 'string' ? filters.brand.trim() || null : null,
      category: typeof filters?.category === 'string' ? filters.category.trim() || null : null,
    };
  }

  // 턴 분석 결과를 바로 쓰지 않고, 누락/중복/타입을 정리해서 세션 상태에 합칠 준비를 한다.
  private FnNormalizeCounselTurn(raw: Partial<CounselTurnResult>): CounselTurnResult {
    return {
      primaryNeeds: this.FnUnique(Array.isArray(raw?.primaryNeeds) ? raw.primaryNeeds : []),
      secondaryNeeds: this.FnUnique(Array.isArray(raw?.secondaryNeeds) ? raw.secondaryNeeds : []),
      goals: this.FnUnique(Array.isArray(raw?.goals) ? raw.goals : []),
      constraints: this.FnUnique(Array.isArray(raw?.constraints) ? raw.constraints : []),
      filters: this.FnNormalizeFilters(raw?.filters),
      summary: String(raw?.summary || '').trim(),
      briefExplanation: String(raw?.briefExplanation || '').trim(),
      followUpQuestion: raw?.followUpQuestion ? String(raw.followUpQuestion).trim() : null,
      followUpTopic: raw?.followUpTopic ? String(raw.followUpTopic).trim() : null,
      readyForRecommendation: Boolean(raw?.readyForRecommendation),
    };
  }

  // 후보 상품을 고를 때 세션/리뷰 결과와 같은 기준의 식별자를 쓰기 위한 helper다.
  private FnGetCandidateId(candidate: any): string {
    const payload = candidate?.payload || {};
    return String(candidate?.id ?? payload.goods_no ?? payload.name ?? '');
  }

  // 이번 턴에서 새로 파악한 정보만 기존 상담 메모에 누적한다.
  private FnMergeCounselState(current: CounselState, analysis: CounselTurnResult): CounselState {
    const shouldAskFollowUp = !analysis.readyForRecommendation && Boolean(analysis.followUpQuestion);
    const mergedFilters = this.FnNormalizeFilters({
      ...current.filters,
      ...analysis.filters,
    });

    return {
      followUpCount: shouldAskFollowUp
        ? Math.min(current.followUpCount + 1, MAX_FOLLOW_UP_QUESTIONS)
        : current.followUpCount,
      primaryNeeds: this.FnUnique([...current.primaryNeeds, ...analysis.primaryNeeds]),
      secondaryNeeds: this.FnUnique([...current.secondaryNeeds, ...analysis.secondaryNeeds]),
      goals: this.FnUnique([...current.goals, ...analysis.goals]),
      constraints: this.FnUnique([...current.constraints, ...analysis.constraints]),
      askedTopics: analysis.followUpTopic
        ? this.FnUnique([...current.askedTopics, analysis.followUpTopic])
        : current.askedTopics,
      summary: analysis.summary || current.summary,
      readyForRecommendation: analysis.readyForRecommendation,
      lastFollowUpQuestion: shouldAskFollowUp ? analysis.followUpQuestion : null,
      filters: mergedFilters,
    };
  }

  // 현재 상담 메모와 사용자 답변을 함께 보고 "더 물을지 / 추천할지"를 LLM이 구조화해서 반환한다.
  private async FnAnalyzeCounselTurn(params: {
    userMessage: string;
    counsel: CounselState;
    history: HistoryEntry[];
  }): Promise<{ content: CounselTurnResult; usage: unknown }> {
    const remainingQuestions = Math.max(0, MAX_FOLLOW_UP_QUESTIONS - params.counsel.followUpCount);
    const prompt = FnBuildCounselTurnPrompt({
      userMessage: params.userMessage,
      counsel: params.counsel,
      history: params.history,
      remainingQuestions,
    });

    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: '너는 영양제 전문 상담사다.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content || '{}';
    return {
      content: this.FnNormalizeCounselTurn(this.FnParseJsonText(raw)),
      usage: response.usage,
    };
  }

  // 마지막 한 문장이 아니라 누적 상담 요약 전체를 검색 질의로 바꿔 최종 추천 품질을 높인다.
  private FnBuildCounselSearchQuery(counsel: CounselState, latestMessage: string): string {
    const semanticQuery = [
      counsel.summary ? `상담요약: ${counsel.summary}` : '',
      counsel.primaryNeeds.length ? `주요니즈: ${counsel.primaryNeeds.join(', ')}` : '',
      counsel.secondaryNeeds.length ? `보조니즈: ${counsel.secondaryNeeds.join(', ')}` : '',
      counsel.goals.length ? `목적: ${counsel.goals.join(', ')}` : '',
      counsel.constraints.length ? `제약: ${counsel.constraints.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return buildChatQueryText({
      semanticQuery,
      filters: counsel.filters,
      userMessage: latestMessage,
    });
  }

  // Qdrant payload 필터는 브랜드/카테고리/가격만 담당하고, 세부 적합성은 후단 LLM 검수에서 걸러낸다.
  private FnBuildQdrantFilter(filters: CounselFilters) {
    const must: any[] = [];

    if (filters.brand) {
      must.push({ key: 'brand', match: { value: filters.brand } });
    }

    if (filters.category) {
      must.push({ key: 'category', match: { value: filters.category } });
    }

    if (filters.min_price || filters.max_price) {
      must.push({
        key: 'price',
        range: {
          gte: filters.min_price ?? undefined,
          lte: filters.max_price ?? undefined,
        },
      });
    }

    return must.length > 0 ? { must } : undefined;
  }

  // 검색 단계에서는 후보를 넉넉히 가져와 놓고, 실제 노출은 뒤에서 정교하게 다시 고른다.
  private async FnSearchQdrant(params: {
    denseVector: number[];
    sparseVector: { indices: number[]; values: number[] };
    filters: CounselFilters;
  }) {
    const { denseVector, sparseVector, filters } = params;
    const collectionName = process.env.COLLECTION_NAME || 'test_products';

    const hasSparse = sparseVector?.indices?.length > 0;
    const makePrefetch = (filter: any) => ([
      {
        query: { nearest: denseVector },
        using: 'dense',
        limit: QDRANT_PREFETCH_LIMIT,
        filter,
      },
      ...(hasSparse ? [{
        query: { nearest: sparseVector },
        using: 'sparse',
        limit: QDRANT_PREFETCH_LIMIT,
        filter,
      }] : []),
    ]);

    const runHybrid = async (filter: any): Promise<any[]> => {
      const response: any = await qdrant.query(collectionName, {
        prefetch: makePrefetch(filter),
        query: { fusion: 'rrf' },
        limit: QDRANT_CANDIDATE_LIMIT,
        score_threshold: QDRANT_SCORE_THRESHOLD,
        with_payload: true,
        filter,
      });

      return Array.isArray(response?.points) ? response.points : [];
    };

    const strictFilter = this.FnBuildQdrantFilter(filters);
    const resultStrict = await runHybrid(strictFilter);
    if (resultStrict.length) return resultStrict;

    const relaxed = { ...filters, brand: null };
    const resultRelaxBrand = await runHybrid(this.FnBuildQdrantFilter(relaxed));
    if (resultRelaxBrand.length) return resultRelaxBrand;

    const relaxedCategory = { ...filters, category: null, brand: null };
    const resultRelaxCategory = await runHybrid(this.FnBuildQdrantFilter(relaxedCategory));
    if (resultRelaxCategory.length) return resultRelaxCategory;

    return runHybrid(undefined);
  }

  // 후보 상품을 상담 요약과 다시 대조해, 최종 추천할 상품과 추천 이유만 남긴다.
  private async FnReviewRecommendationCandidates(params: {
    counsel: CounselState;
    candidates: any[];
  }): Promise<Array<{ productId: string; reason: string }>> {
    if (!params.candidates.length) {
      return [];
    }

    const prompt = FnBuildRecommendationReviewPrompt({
      counselSummary: params.counsel.summary,
      candidates: params.candidates,
    });

    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: '너는 영양제 추천 결과 검수자다.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content || '{}';
    const parsed = this.FnParseJsonText(raw) as RecommendationSelection;
    const selected = Array.isArray(parsed?.selectedProducts) ? parsed.selectedProducts : [];
    const selectedIds = new Set(params.candidates.map((candidate) => this.FnGetCandidateId(candidate)));

    const normalized = selected
      .map((item) => ({
        productId: String(item?.productId || '').trim(),
        reason: String(item?.reason || '').trim(),
      }))
      .filter((item) => item.productId && selectedIds.has(item.productId));

    if (normalized.length > 0) {
      return normalized.slice(0, 3);
    }

    return params.candidates.slice(0, 2).map((candidate) => ({
      productId: this.FnGetCandidateId(candidate),
      reason: '지금까지 상담한 내용과 관련성이 높은 후보로 먼저 추렸습니다.',
    }));
  }

  // 최종 추천 직전, 누적 상담 내용을 한 번 요약해서 사람 읽기 쉬운 멘트로 바꾼다.
  private async FnGenerateRecommendationText(params: {
    counsel: CounselState;
    products: Array<{ name: string; reason: string }>;
  }): Promise<string> {
    if (!params.products.length) {
      return '지금까지 말씀해주신 내용을 바탕으로 맞는 제품을 추려보려 했지만, 지금 정보만으로는 딱 맞는 상품을 고르기 어렵습니다.';
    }

    const prompt = FnBuildRecommendationAnswerPrompt({
      counselSummary: params.counsel.summary,
      products: params.products,
    });

    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: '너는 영양제 전문 상담사다.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    });

    return String(response.choices[0]?.message?.content || '').trim()
      || '지금까지 말씀해주신 내용을 종합해서 먼저 볼 만한 제품을 추렸어요.';
  }

  // 추천 단계에 들어가면 누적 상담 메모로 검색하고, 검수된 후보만 응답 형태로 묶는다.
  private async FnHandleRecommendation(params: {
    message: string;
    session: SessionState;
  }) {
    const queryText = this.FnBuildCounselSearchQuery(params.session.counsel, params.message);
    const embedding = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
    });
    const sparseVector = buildSparseVector(queryText);
    const candidates = await this.FnSearchQdrant({
      denseVector: embedding.data[0].embedding,
      sparseVector,
      filters: params.session.counsel.filters,
    });

    const productReasons = await this.FnReviewRecommendationCandidates({
      counsel: params.session.counsel,
      candidates,
    });
    const reasonMap = new Map(productReasons.map((item) => [item.productId, item.reason]));
    const products = candidates.filter((candidate) => reasonMap.has(this.FnGetCandidateId(candidate))).slice(0, 3);
    const reasonList = products.map((product) => ({
      productId: this.FnGetCandidateId(product),
      reason: reasonMap.get(this.FnGetCandidateId(product)) || '',
    }));
    const text = await this.FnGenerateRecommendationText({
      counsel: params.session.counsel,
      products: products.map((product) => ({
        name: String(product?.payload?.name || this.FnGetCandidateId(product)),
        reason: reasonMap.get(this.FnGetCandidateId(product)) || '',
      })),
    });

    params.session.lastResults = products;

    return {
      mode: 'recommendation',
      text,
      followUpQuestion: null,
      products,
      result: products,
      productReasons: reasonList,
      counselSummary: params.session.counsel.summary,
      usage: embedding.usage,
    };
  }

  // 전체 오케스트레이션:
  // 1) 상담 메모 업데이트
  // 2) 추가 질문 또는 추천 결정
  // 3) 추천 시에는 검색/검수/최종 응답까지 한 번에 처리
  async FnHandleChat(body: { message?: string; sessionId?: string }) {
    try {
      const message = String(body?.message || '').trim();
      const session = this.FnGetSession(body?.sessionId);

      if (!message) {
        return { mode: 'answer', text: '질문을 입력해주세요.' };
      }

      this.FnPushHistory(session, 'user', message);

      if (!session) {
        return { mode: 'answer', text: '세션 정보를 확인할 수 없습니다.' };
      }

      const remainingQuestions = Math.max(0, MAX_FOLLOW_UP_QUESTIONS - session.counsel.followUpCount);
      const { content: turn, usage } = await this.FnAnalyzeCounselTurn({
        userMessage: message,
        counsel: session.counsel,
        history: this.FnGetRecentHistory(session),
      });

      session.counsel = this.FnMergeCounselState(session.counsel, turn);

      const shouldRecommend = turn.readyForRecommendation || remainingQuestions === 0 || !turn.followUpQuestion;
      if (!shouldRecommend) {
        const response = {
          mode: 'counseling',
          text: turn.briefExplanation,
          followUpQuestion: turn.followUpQuestion,
          products: [],
          result: [],
          counselSummary: session.counsel.summary,
          usage,
        };

        this.FnPushHistory(
          session,
          'assistant',
          [turn.briefExplanation, turn.followUpQuestion].filter(Boolean).join('\n'),
        );

        return response;
      }

      const recommendation = await this.FnHandleRecommendation({
        message,
        session,
      });

      this.FnPushHistory(session, 'assistant', recommendation.text);
      session.counsel.readyForRecommendation = true;

      return recommendation;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('검색 실패');
    }
  }
}
