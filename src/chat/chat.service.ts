import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import { qdrant } from '../lib/qdrant';
import { buildChatQueryText, SearchFilters } from '../lib/search-text';
import { buildSparseVector } from '../lib/sparse-vector';

type SessionState = {
  history: Array<{ role: string; content: string; ts: string }>;
  lastResults: any[];
};

type AnalyzeResult = {
  semantic_query: string;
  filters: SearchFilters & {
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
      const message = String(body?.message || '').trim();
      const session = this.FnGetSession(body?.sessionId);
      this.FnPushHistory(session, 'user', message);
      if (!message) {
        return { mode: 'answer', text: '질문을 입력해주세요.' };
      }

      const { content: analyzed } = await this.FnAnalyzeQuery(message);
      const filters = { ...analyzed.filters };

      const queryText = buildChatQueryText({
        semanticQuery: analyzed.semantic_query,
        filters,
        userMessage: message,
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
        if (session) {
          session.lastResults = [];
        }
        return {
          mode: 'answer',
          text: '조건에 맞는 상품을 찾지 못했어요. 질문을 조금 바꿔서 다시 알려주세요.',
        };
      }

      if (session) {
        session.lastResults = result;
      }
      this.FnPushHistory(session, 'assistant', `검색 결과 ${result.length}건`);

      return {
        analyzed,
        result,
        usage: embedding.usage,
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('검색 실패');
    }
  }
}
