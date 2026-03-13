# Chat Counselor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current product-search-first chatbot into a counselor-style flow that explains naturally and only shows curated products when the user explicitly wants recommendations.

**Architecture:** Keep hybrid Qdrant retrieval, but separate retrieval from presentation. Add structured intent analysis, a candidate review pass that filters irrelevant products, and a final answer generation pass that decides whether products should be displayed.

**Tech Stack:** NestJS, TypeScript, OpenAI API, Qdrant, node:test, ts-node

---

### Task 1: Add a failing behavior test for answer-only counseling turns

**Files:**
- Create: `src/chat/chat.service.spec.ts`
- Modify: `src/chat/chat.service.ts`

**Step 1: Write the failing test**

Create a test proving that an explanation-style question returns natural answer text without product display even when retrieval finds candidates.

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: FAIL because the current service returns raw search results instead of an answer-only counseling response

**Step 3: Write minimal implementation**

Refactor `ChatService` so the public response can return `mode`, `text`, and curated `products`, and so explanation-style turns hide products by default.

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: PASS for the new explanation-style behavior

### Task 2: Add a failing behavior test for recommendation candidate filtering

**Files:**
- Modify: `src/chat/chat.service.spec.ts`
- Modify: `src/chat/chat.service.ts`

**Step 1: Write the failing test**

Add a test proving that recommendation requests only return reviewed relevant products instead of the full retrieved candidate list.

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: FAIL because the current service exposes unrelated products

**Step 3: Write minimal implementation**

Add a candidate review step and final product curation logic, then limit display output to reviewed relevant products.

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: PASS for the recommendation filtering behavior

### Task 3: Externalize prompts and structured review helpers

**Files:**
- Create: `src/chat/chat.prompts.ts`
- Modify: `src/chat/chat.service.ts`

**Step 1: Write the failing test**

Add or update tests to verify that the service can answer with no products when reviewed candidates are all irrelevant.

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: FAIL because the service still treats retrieval as display

**Step 3: Write minimal implementation**

Move prompt builders into `chat.prompts.ts` and add helper methods for structured analysis, review, and final answer generation.

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: PASS with answer-only fallback when no candidate is displayable

### Task 4: Verify final behavior

**Files:**
- Modify: `src/chat/chat.service.ts`
- Modify: `src/chat/chat.prompts.ts`
- Modify: `src/chat/chat.service.spec.ts`

**Step 1: Run focused tests**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: PASS

**Step 2: Run type/build verification**

Run: `npm run build`
Expected: PASS with no TypeScript errors

**Step 3: Review response shape**

Confirm the service returns:
- answer-only mode for counseling questions
- curated products only for recommendation turns
- `result` compatibility alias
