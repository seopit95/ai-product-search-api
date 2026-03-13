# Multi-Turn Counseling Chat Design

**Context**

The current backend treats each user message as a direct search query. That makes the chatbot jump to product recommendation too early and lose the chance to understand the user's combined needs such as fatigue, eye strain, digestion, and prevention goals.

**Goal**

Turn the chatbot into a counseling flow that can ask up to three follow-up questions, accumulate the user's needs across turns, and then recommend products based on the combined counseling summary with clear explanation.

**Key Requirements**

- Do not recommend products immediately on the first vague symptom message.
- Ask one follow-up question at a time, up to a maximum of three.
- Use accumulated needs, goals, and constraints to drive the final search query.
- Final recommendation must include both a counseling summary and product-specific recommendation reasons.
- Frontend must show counseling turns as short readable bubbles and recommendation turns as summary bubbles followed by product cards.

**State Model**

Each chat session stores:

- `history`: recent user/assistant turns
- `lastResults`: latest recommended products
- `counsel`:
  - `followUpCount`
  - `primaryNeeds`
  - `secondaryNeeds`
  - `goals`
  - `constraints`
  - `askedTopics`
  - `summary`
  - `readyForRecommendation`
  - `lastFollowUpQuestion`

**Turn Flow**

1. User sends a message.
2. Backend analyzes the message together with the current counseling state.
3. The analyzer returns:
   - newly identified needs
   - updated counseling summary
   - brief explanation text for this turn
   - whether another question is needed
   - the next follow-up question if needed
   - whether the chatbot is ready to recommend
4. Backend merges the new information into session counseling state.
5. If recommendation is ready, or three follow-up questions have already been asked, backend moves to recommendation mode.
6. Otherwise backend returns a counseling response with short explanation text plus a single follow-up question.

**Recommendation Flow**

1. Build a final search query from accumulated counseling summary rather than only the last user message.
2. Run hybrid Qdrant retrieval using the combined needs/goals/constraints.
3. Review candidates with an LLM so only products that match the accumulated counseling context survive.
4. Generate the final answer in short readable blocks:
   - counseling summary
   - recommendation transition
   - products with reasons

**Response Contract**

- Counseling turn:
  - `mode: "counseling"`
  - `text`
  - `followUpQuestion`
  - `products: []`
  - `result: []`
  - `counselSummary`
- Recommendation turn:
  - `mode: "recommendation"`
  - `text`
  - `followUpQuestion: null`
  - `products`
  - `result`
  - `productReasons`
  - `counselSummary`

**Frontend Rendering**

- Counseling turn:
  - render short explanation bubble
  - render follow-up question bubble
  - do not render product cards
- Recommendation turn:
  - render short summary bubble(s)
  - render product cards
  - show product-specific recommendation reason under each card

**Safety and Tone**

- Use plain-language lifestyle explanations, not diagnosis.
- Keep each bubble to one or two sentences.
- Ask only one follow-up question per turn.
- If constraints are unknown but recommendation must proceed, use cautious wording.
