import test from 'node:test';
import assert from 'node:assert/strict';

import { ChatService } from './chat.service';

function createService() {
  return new ChatService();
}

test('FnHandleChat sends a symptom-only message directly through search flow', async () => {
  const service = createService() as any;
  const searchResult = [{ payload: { name: '루테인' } }];

  service.FnAnalyzeQuery = async (message: string) => ({
    content: {
      semantic_query: message,
      filters: {
        max_price: null,
        min_price: null,
        brand: null,
        category: null,
      },
      intent: '눈 건강 관련 상품 검색',
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

  service.FnSearchQdrant = async () => searchResult;

  const response = await service.FnHandleChat({
    message: '눈이 침침해',
    sessionId: 'session-direct-search',
  });

  assert.deepEqual(response.result, searchResult);
  assert.equal(response.analyzed.intent, '눈 건강 관련 상품 검색');
});

test('FnHandleChat returns a prompt for an empty message', async () => {
  const service = createService();

  const response = await service.FnHandleChat({
    message: '',
    sessionId: 'session-empty-message',
  });

  assert.deepEqual(response, {
    mode: 'answer',
    text: '질문을 입력해주세요.',
  });
});
