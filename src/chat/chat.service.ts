import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import { qdrant } from '../lib/qdrant';
import { chatPolicy } from '../config/chat-policy';
import {
  buildQueryText,
  buildSparseVector,
  normalizeBrand,
  normalizeCategory,
} from '../lib/search-utils';

type SessionState = {
  history: Array<{ role: string; content: string; ts: string }>;
  lastResults: any[];
  needStage: number;
  pendingNeedMessage: string;
};

type AnalyzeResult = {
  semantic_query: string;
  filters: {
    max_price: number | null;
    min_price: number | null;
    brand: string | null;
    category: string | null;
  };
  intent: string;
};

@Injectable()
export class ChatService {
  private readonly client: OpenAI;
  private readonly sessionStore = new Map<string, SessionState>();

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  private FnGetSession(sessionId?: string): SessionState | null {
    if (!sessionId) return null;
    if (!this.sessionStore.has(sessionId)) {
      this.sessionStore.set(sessionId, {
        history: [],
        lastResults: [],
        needStage: 0,
        pendingNeedMessage: '',
      });
    }
    return this.sessionStore.get(sessionId) || null;
  }

  private FnPushHistory(session: SessionState | null, role: string, content: string): void {
    if (!session) return;
    session.history.push({ role, content, ts: new Date().toISOString() });
    if (session.history.length > 20) {
      session.history = session.history.slice(-20);
    }
  }

  private FnIsProductSearchMessage(message: string): boolean {
    const text = String(message || '').toLowerCase();
    return chatPolicy.intent.productSearchKeywords.some((k) => text.includes(k));
  }

  private FnIsFollowupEffectQuestion(message: string): boolean {
    const text = String(message || '').toLowerCase();
    return chatPolicy.intent.followupKeywords.some((k) => text.includes(k));
  }

  private FnBuildNeedQuestion(stage: number): string {
    if (stage === 1) return chatPolicy.questions.needStage1;
    return chatPolicy.questions.needStage2;
  }

  private FnIsNegativeAnswer(text: string): boolean {
    const raw = String(text || '').toLowerCase().trim();
    return chatPolicy.intent.negativeAnswers.some((v) => raw === v || raw.includes(v));
  }

  private FnHasNeedKeywords(text: string): boolean {
    const raw = String(text || '').toLowerCase();
    return chatPolicy.intent.needKeywords.some((k) => raw.includes(k));
  }

  private FnExtractCautionKeywords(text: string): string[] {
    const raw = String(text || '').toLowerCase();
    return chatPolicy.caution.keywords.filter((k) => raw.includes(k));
  }

  private FnIsHighRiskForProduct(payload: any, cautionKeywords: string[]): boolean {
    if (!cautionKeywords?.length) return false;
    const list = Array.isArray(payload?.not_recommended_for) ? payload.not_recommended_for : [];
    if (!list.length) return false;
    const text = list.join(' ').toLowerCase();
    return cautionKeywords.some((k) => text.includes(k));
  }

  private FnBuildNoRecommendationMessage(cautionKeywords: string[]): string {
    const hasPregnancy = cautionKeywords.some((k) => ['임신', '임산부'].includes(k));
    const hasBreastfeeding = cautionKeywords.some((k) => ['수유', '수유부'].includes(k));
    const hasChild = cautionKeywords.some((k) => ['어린이', '소아', '청소년'].includes(k));

    if (hasPregnancy) return chatPolicy.caution.messages.pregnancy;
    if (hasBreastfeeding) return chatPolicy.caution.messages.breastfeeding;
    if (hasChild) return chatPolicy.caution.messages.child;
    return chatPolicy.caution.messages.default;
  }

  private FnFindReferencedProduct(message: string, results: any[]): any | null {
    const text = String(message || '').toLowerCase();
    for (const item of results) {
      const name = String(item?.payload?.name || '').toLowerCase();
      if (name && text.includes(name)) return item;
    }
    return results[0] || null;
  }

  private async FnAnalyzeQuery(userMessage: string): Promise<{ content: AnalyzeResult; usage: unknown }> {
    const prompt = `
너는 쇼핑몰 검색엔진의 쿼리 분석기다.

사용자의 질문을 분석해서 아래 JSON으로 변환해라.

JSON 스키마:
{
  "semantic_query": string,
  "filters": {
    "max_price": number | null,
    "min_price": number | null,
    "brand": string | null,
    "category": string | null
  },
  "intent": string
}

규칙:
- semantic_query:
  - 사용자가 말한 표현과 의미를 최대한 유지한다
  - 검색에 도움이 되도록 의미를 자연스럽게 보강한다
  - 반드시 한 문장일 필요는 없다
  - 사용자가 언급하지 않은 정보는 억지로 추가하지 마라
  - 질문에서 사용자가 원하는 니즈에 맞는 키워드를 우선적으로 고려해 상품을 조회해야한다.

- filters:
  - 확실한 조건만 추출
  - 애매하면 null
- intent:
  - 사용자의 실제 목적을 한 문장으로 요약한다

JSON 외의 말은 절대 출력하지 마라.

사용자 질문:
"${userMessage}"
`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: '너는 검색 쿼리 분석기다.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content || '{}';
    return { content: JSON.parse(raw) as AnalyzeResult, usage: response.usage };
  }

  private FnBuildQdrantFilter(filters: AnalyzeResult['filters']) {
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

  private async FnSearchQdrant(params: {
    denseVector: number[];
    sparseVector: { indices: number[]; values: number[] };
    filters: AnalyzeResult['filters'];
  }) {
    const { denseVector, sparseVector, filters } = params;
    const collectionName = process.env.COLLECTION_NAME || 'test_products';

    const hasSparse = sparseVector?.indices?.length > 0;
    const makePrefetch = (filter: any) => ([
      {
        query: { nearest: denseVector },
        using: 'dense',
        limit: 50,
        filter,
      },
      ...(hasSparse ? [{
        query: { nearest: sparseVector },
        using: 'sparse',
        limit: 50,
        filter,
      }] : []),
    ]);

    const runHybrid = async (filter: any): Promise<any[]> => {
      const response: any = await qdrant.query(collectionName, {
        prefetch: makePrefetch(filter),
        query: { fusion: 'rrf' },
        limit: 5,
        score_threshold: 0.25,
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

  async FnHandleChat(body: { message?: string; sessionId?: string }) {
    try {
      const message = String(body?.message || '');
      const session = this.FnGetSession(body?.sessionId);
      this.FnPushHistory(session, 'user', message);

      if (session?.needStage === 1) {
        if (this.FnIsNegativeAnswer(message)) {
          return { mode: 'answer', text: chatPolicy.responses.needOnlyPrompt };
        }
        session.pendingNeedMessage = message;
        session.needStage = 2;
        return { mode: 'answer', text: this.FnBuildNeedQuestion(2) };
      }

      if (session?.needStage === 2) {
        const combined = [session.pendingNeedMessage, message].filter(Boolean).join('\n');
        session.needStage = 0;
        session.pendingNeedMessage = '';

        const cautionKeywords = this.FnExtractCautionKeywords(combined);
        const { content: analyzed } = await this.FnAnalyzeQuery(combined);
        const filters = {
          ...analyzed.filters,
          brand: normalizeBrand(analyzed.filters?.brand),
          category: normalizeCategory(analyzed.filters?.category),
        };

        const queryText = buildQueryText({
          semantic_query: analyzed.semantic_query,
          filters,
          userMessage: combined,
        });

        const embedding = await this.client.embeddings.create({
          model: 'text-embedding-3-small',
          input: queryText,
        });

        const sparseVector = buildSparseVector(queryText);
        const result = await this.FnSearchQdrant({
          denseVector: embedding.data[0].embedding,
          sparseVector,
          filters,
        });

        if (!result.length) {
          session.lastResults = [];
          return { mode: 'answer', text: chatPolicy.responses.noResults };
        }

        const safeResults = result.filter((item: any) => !this.FnIsHighRiskForProduct(item?.payload, cautionKeywords));
        if (!safeResults.length) {
          session.lastResults = [];
          const text = cautionKeywords.length
            ? this.FnBuildNoRecommendationMessage(cautionKeywords)
            : chatPolicy.responses.noResults;
          return { mode: 'answer', text };
        }

        session.lastResults = safeResults;
        this.FnPushHistory(session, 'assistant', `검색 결과 ${safeResults.length}건`);
        return {
          analyzed,
          result: safeResults,
          usage: embedding.usage,
        };
      }

      const hasLastResults = (session?.lastResults?.length || 0) > 0;
      const isProductIntent = this.FnIsProductSearchMessage(message);
      const isFollowup = this.FnIsFollowupEffectQuestion(message);

      if (!isProductIntent || isFollowup) {
        if (isFollowup && hasLastResults) {
          const target = this.FnFindReferencedProduct(message, session?.lastResults || []);
          if (!target) {
            return { mode: 'answer', text: chatPolicy.responses.askProductName };
          }

          const payload = target.payload || {};
          const secondary = Array.isArray(payload.secondary_benefits) ? payload.secondary_benefits : [];
          const recommended = Array.isArray(payload.recommended_for) ? payload.recommended_for : [];

          const lines = [`"${payload.name || '이 상품'}" 기준으로 추가 효능과 추천 대상 정보를 정리해드릴게요.`];
          if (secondary.length) {
            lines.push(`부수 효능: ${secondary.slice(0, 5).join(', ')}`);
          } else {
            lines.push('부수 효능 정보는 아직 부족해요.');
          }
          if (recommended.length) {
            lines.push(`추천 대상: ${recommended.slice(0, 5).join(', ')}`);
          } else {
            lines.push('추천 대상 정보는 아직 부족해요.');
          }

          const answerText = lines.join('\n');
          this.FnPushHistory(session, 'assistant', answerText);
          return { mode: 'answer', text: answerText };
        }

        if (isFollowup && !hasLastResults && isProductIntent) {
          if (session) {
            session.needStage = 1;
            session.pendingNeedMessage = message;
          }
          return { mode: 'answer', text: this.FnBuildNeedQuestion(1) };
        }

        if (isFollowup && !hasLastResults) {
          return { mode: 'answer', text: chatPolicy.responses.needMissing };
        }

        return { mode: 'answer', text: chatPolicy.responses.recommendPrompt };
      }

      if (this.FnIsProductSearchMessage(message)) {
        if (session) {
          if (this.FnHasNeedKeywords(message)) {
            session.needStage = 2;
            session.pendingNeedMessage = message;
            return { mode: 'answer', text: this.FnBuildNeedQuestion(2) };
          }
          session.needStage = 1;
          session.pendingNeedMessage = message;
        }
        return { mode: 'answer', text: this.FnBuildNeedQuestion(1) };
      }

      return { mode: 'answer', text: chatPolicy.responses.recommendPrompt };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('검색 실패');
    }
  }
}
