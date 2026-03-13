# Multi-Turn Counseling Chat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a session-based counseling chatbot that can ask up to three follow-up questions, accumulate user needs, and then recommend products with a combined summary and product-specific reasons.

**Architecture:** Add counseling state to the NestJS chat session, introduce structured prompt helpers for turn analysis, recommendation-query building, candidate review, and final answer generation, then update the frontend renderer so counseling and recommendation turns display as short readable chat bubbles.

**Tech Stack:** NestJS, TypeScript, OpenAI API, Qdrant, node:test, plain browser JavaScript

---

### Task 1: Lock the backend counseling turn behavior with failing tests

**Files:**
- Create: `src/chat/chat.service.spec.ts`
- Modify: `src/chat/chat.service.ts`

**Step 1: Write the failing test**

Add a test proving that a vague symptom message returns `mode: "counseling"` with short text, a follow-up question, and no product results.

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: FAIL because the current service returns direct search results instead of a counseling turn

**Step 3: Write minimal implementation**

Add counseling session state and a first-turn counseling decision path that can return a follow-up question without searching.

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: PASS

### Task 2: Lock the transition to recommendation mode

**Files:**
- Modify: `src/chat/chat.service.spec.ts`
- Modify: `src/chat/chat.service.ts`

**Step 1: Write the failing test**

Add a test proving that once enough counseling data is gathered, the service switches to recommendation mode, searches using combined needs, and returns products plus recommendation reasons.

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: FAIL because the current service has no accumulated counseling summary or recommendation transition

**Step 3: Write minimal implementation**

Add final-query generation, product review, and final recommendation response shape.

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: PASS

### Task 3: Extract prompt helpers for structured counseling orchestration

**Files:**
- Create: `src/chat/chat.prompts.ts`
- Modify: `src/chat/chat.service.ts`

**Step 1: Write the failing test**

Add or extend tests to verify the service keeps counseling data across turns and does not ask more than one follow-up question per turn.

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: FAIL because the current flow has no structured counseling prompt layer

**Step 3: Write minimal implementation**

Move prompt builders into `chat.prompts.ts` and add helper methods for turn analysis, final query creation, candidate review, and final response generation.

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: PASS

### Task 4: Lock the frontend rendering behavior

**Files:**
- Modify: `public/chat-render.js`
- Modify: `public/index.js`
- Modify: `public/chat-render.test.js`

**Step 1: Write the failing test**

Add a test proving that counseling responses render text bubbles plus a follow-up question bubble, and recommendation responses render summary text before product cards.

**Step 2: Run test to verify it fails**

Run: `node --test public/chat-render.test.js`
Expected: FAIL because the current renderer does not explicitly model counseling follow-up questions or product reasons

**Step 3: Write minimal implementation**

Update the render model and DOM renderer to show counseling bubbles first, then product cards with recommendation reasons when products exist.

**Step 4: Run test to verify it passes**

Run: `node --test public/chat-render.test.js`
Expected: PASS

### Task 5: Verify final behavior

**Files:**
- Modify: `src/chat/chat.service.ts`
- Modify: `src/chat/chat.prompts.ts`
- Modify: `src/chat/chat.service.spec.ts`
- Modify: `public/chat-render.js`
- Modify: `public/chat-render.test.js`
- Modify: `public/index.js`

**Step 1: Run focused backend tests**

Run: `node --require ts-node/register/transpile-only --test src/chat/chat.service.spec.ts`
Expected: PASS

**Step 2: Run focused frontend tests**

Run: `node --test public/chat-render.test.js`
Expected: PASS

**Step 3: Run type/build verification**

Run: `npm run build`
Expected: PASS with no TypeScript errors

**Step 4: Review response shape**

Confirm the service returns:
- `mode: "counseling"` during information gathering
- `mode: "recommendation"` once enough information is gathered
- `followUpQuestion` only during counseling mode
- `productReasons` aligned with the returned products
