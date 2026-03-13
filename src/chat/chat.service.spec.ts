import test from 'node:test';
import assert from 'node:assert/strict';

import { ChatService } from './chat.service';

function FnCreateService() {
  process.env.OPENAI_API_KEY = 'test-key';
  return new ChatService();
}

function FnCreateCandidate(name: string) {
  return {
    id: name,
    payload: {
      goods_no: name,
      name,
      effects_summary: `${name} 효능`,
    },
  };
}

test('FnHandleChat returns counseling mode for a vague symptom message', async () => {
  const service = FnCreateService() as any;

  service.FnAnalyzeCounselTurn = async () => ({
    content: {
      primaryNeeds: ['피로'],
      secondaryNeeds: [],
      goals: ['개선'],
      constraints: [],
      filters: {
        max_price: null,
        min_price: null,
        brand: null,
        category: null,
      },
      summary: '피로 개선 목적 상담',
      briefExplanation: '피로는 수면 리듬이나 눈 피로 같은 생활 요인과 같이 나타나기 쉬워요.',
      followUpQuestion: '눈 피로나 소화 불편도 같이 느끼시나요?',
      followUpTopic: 'secondary_symptom',
      readyForRecommendation: false,
    },
    usage: { total_tokens: 1 },
  });

  service.FnAnalyzeQuery = async () => ({
    content: {
      semantic_query: '피로 관련 상품 검색',
      filters: {
        max_price: null,
        min_price: null,
        brand: null,
        category: null,
      },
      intent: '피로 관련 상품 검색',
    },
    usage: { total_tokens: 1 },
  });

  service.client = {
    embeddings: {
      create: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { total_tokens: 1 },
      }),
    },
  };

  service.FnSearchQdrant = async () => [FnCreateCandidate('멀티비타민')];

  const response = await service.FnHandleChat({
    message: '요즘 너무 피로해',
    sessionId: 'session-counseling-first-turn',
  });

  assert.equal(response.mode, 'counseling');
  assert.equal(response.text, '피로는 수면 리듬이나 눈 피로 같은 생활 요인과 같이 나타나기 쉬워요.');
  assert.equal(response.followUpQuestion, '눈 피로나 소화 불편도 같이 느끼시나요?');
  assert.deepEqual(response.products, []);
  assert.deepEqual(response.result, []);
  assert.equal(response.counselSummary, '피로 개선 목적 상담');
});

test('FnHandleChat returns a prompt for an empty message', async () => {
  const service = FnCreateService();

  const response = await service.FnHandleChat({
    message: '',
    sessionId: 'session-empty-message',
  });

  assert.deepEqual(response, {
    mode: 'answer',
    text: '질문을 입력해주세요.',
  });
});

test('FnHandleChat returns recommendation mode once enough counseling data is gathered', async () => {
  const service = FnCreateService() as any;
  const session = service.FnGetSession('session-ready-to-recommend');
  const candidate = FnCreateCandidate('루테인');

  session.counsel = {
    ...session.counsel,
    followUpCount: 2,
    primaryNeeds: ['피로'],
    secondaryNeeds: ['눈 피로'],
    goals: ['개선', '예방'],
    constraints: [],
    summary: '피로와 눈 피로를 함께 관리하고 싶은 상태',
  };

  service.FnAnalyzeCounselTurn = async () => ({
    content: {
      primaryNeeds: ['피로'],
      secondaryNeeds: ['눈 피로'],
      goals: ['개선', '예방'],
      constraints: [],
      filters: {
        max_price: null,
        min_price: null,
        brand: null,
        category: null,
      },
      summary: '피로와 눈 피로를 함께 관리하고 싶은 상태',
      briefExplanation: '이제는 종합해서 제품을 보는 게 더 적절해요.',
      followUpQuestion: null,
      followUpTopic: null,
      readyForRecommendation: true,
    },
    usage: { total_tokens: 1 },
  });

  service.client = {
    embeddings: {
      create: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { total_tokens: 1 },
      }),
    },
  };

  service.FnSearchQdrant = async () => [candidate];
  service.FnReviewRecommendationCandidates = async () => [
    {
      productId: candidate.id,
      reason: '피로와 눈 피로를 같이 고려한 후보입니다.',
    },
  ];
  service.FnGenerateRecommendationText = async () => '지금까지 말씀해주신 내용을 종합해서 먼저 볼 만한 제품을 추렸어요.';

  const response = await service.FnHandleChat({
    message: '제품 추천해줘',
    sessionId: 'session-ready-to-recommend',
  });

  assert.equal(response.mode, 'recommendation');
  assert.equal(response.followUpQuestion, null);
  assert.equal(response.text, '지금까지 말씀해주신 내용을 종합해서 먼저 볼 만한 제품을 추렸어요.');
  assert.deepEqual(response.products, [candidate]);
  assert.deepEqual(response.result, [candidate]);
  assert.deepEqual(response.productReasons, [
    {
      productId: candidate.id,
      reason: '피로와 눈 피로를 같이 고려한 후보입니다.',
    },
  ]);
  assert.equal(response.counselSummary, '피로와 눈 피로를 함께 관리하고 싶은 상태');
});
