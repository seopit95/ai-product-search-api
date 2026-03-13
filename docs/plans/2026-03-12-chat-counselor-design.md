# Chat Counselor Design

**Context**

The current chat flow analyzes the user's message and always returns vector search results when Qdrant finds anything. That causes two problems:
- counseling-style questions still surface product links
- low-relevance products leak into the response because retrieval and display are treated as the same decision

**Goals**

- Distinguish recommendation intent from explanation/comparison/suitability intent
- Hide products by default unless the user clearly asks for recommendations or product suggestions
- Re-rank retrieved candidates and exclude unrelated products before display
- Return a counselor-style natural language answer grounded in retrieved product data

**Non-Goals**

- Rebuilding the indexing pipeline
- Adding new external libraries
- Changing the controller contract beyond fields needed for the improved chat response

**Architecture**

1. Query analysis
   - Keep an LLM analysis step, but return explicit structured fields for:
     - `intentType`
     - `shouldSearchProducts`
     - `shouldShowProducts`
     - `semanticQuery`
     - explicit filters
   - Use recent session history as light context for follow-up turns.

2. Candidate retrieval
   - Continue using Qdrant hybrid search.
   - Increase candidate count so retrieval is recall-oriented instead of directly presentation-oriented.
   - Preserve strict-to-relaxed filter fallback.

3. Candidate review
   - Add a second LLM pass that receives the user message, analysis result, and product candidates.
   - For each candidate, classify it as `relevant`, `borderline`, or `irrelevant`.
   - Decide whether products should be shown for this turn.
   - Keep only strongly relevant products, with a small final limit.

4. Final answer generation
   - Generate a natural counselor-style answer from the reviewed context.
   - Recommendation requests return answer text plus curated products.
   - Explanation/comparison/suitability questions default to answer-only responses.
   - If all candidates are weak or irrelevant, answer without products.

**Response Shape**

- `mode`: `answer` or `recommendation`
- `text`: final natural language counselor answer
- `products`: curated products safe to display
- `result`: alias of `products` for compatibility with existing consumers
- `analyzed`: structured analysis output

**Filtering Rules**

- Recommendation intent:
  - allow only reviewed `relevant` products
  - maximum 3 products
- Explanation/comparison/suitability intent:
  - default to no products
  - still allow retrieval for grounding the answer
- If no product survives review:
  - answer with text only

**Safety Rules**

- Avoid diagnosis or treatment claims
- Use cautious wording for efficacy and suitability
- Prefer "can help", "is often used for", "may suit" style language
- If user intent is unclear, answer conservatively without products

**Testing Strategy**

- Explanation question returns text only even if search finds products
- Recommendation question returns only reviewed relevant products
- Irrelevant candidates are removed before final response
- Empty input keeps the current validation behavior
