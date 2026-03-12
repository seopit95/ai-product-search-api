# AGENT 참고 메모

현재 코드 기준의 운영/개발 메모입니다.

## 런타임 구조
- NestJS(TypeScript) API 서버.
- 검색은 Qdrant 하이브리드 질의 사용:
  - `dense`: OpenAI 임베딩 (`text-embedding-3-small`, 1536)
  - `sparse`: 해시 기반 sparse vector
  - 최종 결합: `fusion: "rrf"`
- 필터 적용은 엄격 -> 완화 순서로 재시도.

## 검색 텍스트/벡터
- 질의 텍스트 생성: `src/lib/search-text.ts`
- 문서 텍스트 생성: `src/lib/search-text.ts`
- sparse 벡터 생성: `src/lib/sparse-vector.ts`
- 별도 하드코딩 동의어/정규화 사전은 사용하지 않음.

## 인덱싱 규칙
- 문서 텍스트는 payload 핵심 필드(name/brand/category/price/description/효능 관련)를 직렬화해서 생성.
- 포인트 저장 시 `dense + sparse` 벡터를 함께 upsert.

## Qdrant 컬렉션
- 기본 컬렉션: `test_products`
- named vectors:
  - `dense`: Cosine, size 1536
  - `sparse`: sparse vector

## 운영 커맨드
- 개발 서버: `npm run start:dev`
- 빌드: `npm run build`
- 컬렉션 생성: `npm run create:collection`
- 포인트 적재: `npm run insert:points`

## 정책 파일
- 상담 흐름/문구/키워드: `src/config/chat-policy.ts`
- 채팅 오케스트레이션: `src/chat/chat.service.ts`
