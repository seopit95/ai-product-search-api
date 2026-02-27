// @ts-nocheck

import dotenv from "dotenv";
dotenv.config();
import { qdrant } from "../lib/qdrant";
import { dummyData } from "../data/dummyData";
import { goodsData } from "../data/goodsData";
import OpenAI from "openai";
import { buildDocumentText, buildSparseVector } from "../lib/search-utils";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { ocrImageUrl } from "../lib/vision-ocr";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const COLLECTION_NAME = process.env.COLLECTION_NAME || "test_products";
const IMAGE_STRUCTURE_MODEL = "gpt-4.1-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";
const IMAGE_EXTRACTION_CONCURRENCY = 3;
const NORMALIZATION_DIR = path.resolve("data");
const NORMALIZATION_CANDIDATES_FILE = path.join(NORMALIZATION_DIR, "normalization-candidates.jsonl");
// OpenAI 사용량을 추적한다.
const usageStats = {
  imageStructure: {
    requests: 0,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
  },
  nameInsights: {
    requests: 0,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
  },
  embeddings: {
    requests: 0,
    input_tokens: 0,
    total_tokens: 0,
  },
};

export async function FnCreateCollection() {
  const collectionName = process.env.COLLECTION_NAME || "test_products";
  await qdrant.createCollection(collectionName, {
    vectors: {
      dense: {
        size: 1536,
        distance: "Cosine",
      },
    },
    sparse_vectors: {
      sparse: {},
    },
  });

  console.log(`컬렉션 생성 완료: ${collectionName}`);
}

// 토큰 사용량을 단계별로 출력한다.
function logTokenUsage(stage, usage, extra = {}) {
  if (!usage) return;
  const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;
  console.log("[token usage]", {
    stage,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    ...extra,
  });
}

// VLM 응답에서 JSON 결과를 추출한다.
function extractJsonFromResponse(response) {
  if (response?.output_parsed) return response.output_parsed;
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return JSON.parse(response.output_text);
  }

  const output = response?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!Array.isArray(item?.content)) continue;
      for (const part of item.content) {
        if (part?.parsed) return part.parsed;
        if (typeof part?.text === "string" && part.text.trim()) return JSON.parse(part.text);
      }
    }
  }
  throw new Error("Failed to parse VLM JSON response");
}

// 상품명 기반으로 대표 성분 효능/추천 대상 정보를 추출한다.
async function extractNameInsights(productName: string) {
  if (!productName) {
    return {
      primary_ingredient: "",
      effects_summary: "",
      secondary_benefits: [],
      recommended_for: [],
      not_recommended_for: [],
      notes: "",
    };
  }

  const response = await client.responses.create({
    model: IMAGE_STRUCTURE_MODEL,
    instructions: [
      "너는 영양제 상품명 기반 요약 생성기다.",
      "상품명에 포함된 대표 성분을 중심으로 대표 효능을 간략히 정리한다.",
      "의학적 진단/치료/확정 표현은 금지하고, 일반적/보편적 정보로만 작성한다.",
      "기술/원료/전문 용어는 가능한 한 피하고, 사용자가 이해하기 쉬운 표현을 사용한다.",
      "모호하면 빈 문자열/빈 배열로 둔다.",
      "반드시 JSON만 출력한다.",
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "상품명:",
              productName,
              "",
              "요구사항:",
              "- 대표 성분(primary_ingredient)을 추출",
              "- 대표 효능 요약(effects_summary)을 1~2문장",
              "- 부수적인 효능(secondary_benefits)을 2~6개 짧은 목록으로",
              "- 추천 대상(recommended_for)과 비추천 대상(not_recommended_for)을 간단한 목록으로",
              "- 추가 주의사항(notes)이 있으면 간단히",
            ].join("\n"),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "SupplementNameInsights",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            primary_ingredient: { type: "string" },
            effects_summary: { type: "string" },
            secondary_benefits: { type: "array", items: { type: "string" } },
            recommended_for: { type: "array", items: { type: "string" } },
            not_recommended_for: { type: "array", items: { type: "string" } },
            notes: { type: "string" },
          },
          required: [
            "primary_ingredient",
            "effects_summary",
            "secondary_benefits",
            "recommended_for",
            "not_recommended_for",
            "notes",
          ],
        },
      },
    },
  });

  const extracted = extractJsonFromResponse(response);
  if (response?.usage) {
    logTokenUsage("name_insights", response.usage, { productName });
    usageStats.nameInsights.requests += 1;
    usageStats.nameInsights.input_tokens += response.usage.input_tokens || 0;
    usageStats.nameInsights.output_tokens += response.usage.output_tokens || 0;
    usageStats.nameInsights.total_tokens += response.usage.total_tokens || 0;
  }
  return extracted;
}

// OCR 결과가 없을 때 기본 구조를 반환한다.
function buildEmptyImageData() {
  return {
    summary: "",
    benefits: [],
    ingredients: [],
    dosage: "",
    cautions: [],
    interactions: [],
  };
}

// 이미지 URL을 OCR → 구조화 JSON으로 변환한다.
async function extractImageData(imageUrl) {
  const ocrText = await ocrImageUrl(imageUrl);
  if (!ocrText) {
    return buildEmptyImageData();
  }

  const response = await client.responses.create({
    model: IMAGE_STRUCTURE_MODEL,
    instructions: [
      "너는 영양제 상품 상세 OCR 텍스트 정보 추출기다.",
      "입력 텍스트(OCR)에 보이는 내용만 JSON으로 구조화한다.",
      "추측 금지, 없으면 빈 문자열/빈 배열로 반환한다.",
      "구매자가 궁금해할 핵심 정보를 간략하게 정리한다.",
      "요약(summary)와 구매 상담에 필요한 핵심 정보만 간략히 추출한다.",
      "기능/효능, 주요 성분/함량, 섭취 방법, 주의 대상, 상호작용을 분리한다.",
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "다음은 상품 상세 이미지의 OCR 결과다. 이 텍스트만 근거로 구조화해줘.",
              "",
              ocrText,
            ].join("\n"),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ImageProductExtraction",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            benefits: { type: "array", items: { type: "string" } },
            ingredients: { type: "array", items: { type: "string" } },
            dosage: { type: "string" },
            cautions: { type: "array", items: { type: "string" } },
            interactions: { type: "array", items: { type: "string" } },
          },
          required: [
            "summary",
            "benefits",
            "ingredients",
            "dosage",
            "cautions",
            "interactions",
          ],
        },
      },
    },
  });

  const extracted = extractJsonFromResponse(response);
  if (response?.usage) {
    logTokenUsage("image_structure", response.usage, {
      imageUrl,
      ocr_chars: ocrText.length,
    });
    usageStats.imageStructure.requests += 1;
    usageStats.imageStructure.input_tokens += response.usage.input_tokens || 0;
    usageStats.imageStructure.output_tokens += response.usage.output_tokens || 0;
    usageStats.imageStructure.total_tokens += response.usage.total_tokens || 0;
  }
  return {
    ...extracted,
  };
}

// 기존 태그와 이미지 추출 태그를 병합한다.
// 동시성 제한을 두고 배열 작업을 수행한다.
async function mapWithConcurrency(items, concurrency, task) {
  const out = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await task(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => worker()),
  );

  return out;
}

// HTML에서 img src URL 목록을 추출한다.
function extractImageUrlsFromHtml(html) {
  if (!html) return [];
  const urls = [];
  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) urls.push(match[1]);
  }
  return urls;
}

// HTML 태그를 제거하고 텍스트만 남긴다.
function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// goodsData 형태를 insertPoints 포맷으로 변환한다.
function mapGoodsToPoint(goods) {
  const goodsNo = goods?.goodsNo;
  const id = goodsNo && Number.isFinite(Number(goodsNo))
    ? Number(goodsNo)
    : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const price = typeof goods?.goodsPrice === "string" || typeof goods?.goodsPrice === "number"
    ? Number(goods.goodsPrice)
    : null;
  const descriptionHtml = goods?.goodsDescription || "";
  const detailImages = extractImageUrlsFromHtml(descriptionHtml);
  return {
    id,
    payload: {
      goods_no: goods?.goodsNo ? String(goods.goodsNo) : "",
      name: goods?.goodsNm || "",
      brand: goods?.brand || "",
      category: goods?.cateNm || "",
      price: Number.isFinite(price) ? price : null,
      description: stripHtml(descriptionHtml),
      image_url: goods?.imageUrl || "",
      detail_images: detailImages,
    },
  };
}

// goodsData 입력을 배열로 정규화한다.
function normalizeGoodsInput(input) {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") return [input];
  return [];
}

// 인서트 시 브랜드/카테고리 후보를 수집한다.
async function collectNormalizationCandidates(points) {
  const seen = new Set();
  const lines = [];
  const ts = new Date().toISOString();

  points.forEach((point) => {
    const payload = point?.payload || {};
    const brand = typeof payload.brand === "string" ? payload.brand.trim() : "";
    const category = typeof payload.category === "string" ? payload.category.trim() : "";

    if (brand) {
      const key = `brand:${brand}`;
      if (!seen.has(key)) {
        seen.add(key);
        lines.push(JSON.stringify({
          type: "brand",
          value: brand,
          source: "insertPoints",
          product_id: point?.id ?? null,
          ts,
        }));
      }
    }

    if (category) {
      const key = `category:${category}`;
      if (!seen.has(key)) {
        seen.add(key);
        lines.push(JSON.stringify({
          type: "category",
          value: category,
          source: "insertPoints",
          product_id: point?.id ?? null,
          ts,
        }));
      }
    }
  });

  if (!lines.length) return;
  await mkdir(NORMALIZATION_DIR, { recursive: true });
  await appendFile(NORMALIZATION_CANDIDATES_FILE, `${lines.join("\n")}\n`, "utf8");
  console.log(`[normalization] candidates appended: ${lines.length}`);
}

// 상품명 기반 인사이트를 payload에 추가한다.
async function enrichWithNameInsights(points) {
  return mapWithConcurrency(points, IMAGE_EXTRACTION_CONCURRENCY, async (point) => {
    if (!point?.payload) return point;
    const insights = await extractNameInsights(point.payload.name);
    return {
      ...point,
      payload: {
        ...point.payload,
        primary_ingredient: insights.primary_ingredient || "",
        effects_summary: insights.effects_summary || "",
        secondary_benefits: Array.isArray(insights.secondary_benefits) ? insights.secondary_benefits : [],
        recommended_for: Array.isArray(insights.recommended_for) ? insights.recommended_for : [],
        not_recommended_for: Array.isArray(insights.not_recommended_for) ? insights.not_recommended_for : [],
        notes: insights.notes || "",
      },
    };
  });
}

// 여러 상세 이미지 OCR/구조화 결과를 요약 텍스트로 만든다.
function buildDetailImageText(extractedList) {
  if (!Array.isArray(extractedList) || !extractedList.length) return "";
  return extractedList.map((item, idx) => {
    const data = item?.data || {};
    return [
      `상세이미지#${idx + 1}`,
      `이미지요약: ${data.summary || ""}`,
      `이미지효능: ${(data.benefits || []).join(" ")}`,
      `이미지성분: ${(data.ingredients || []).join(" ")}`,
      `이미지섭취방법: ${data.dosage || ""}`,
      `이미지주의대상: ${(data.cautions || []).join(" ")}`,
      `이미지상호작용: ${(data.interactions || []).join(" ")}`,
    ].join("\n");
  }).join("\n");
}

// 포인트에 상세 이미지 OCR/구조화 데이터를 추가한다.
async function enrichWithImageData(points) {
  const enriched = await mapWithConcurrency(points, IMAGE_EXTRACTION_CONCURRENCY, async (point) => {
    if (!point?.payload) return point;
    const detailImages = Array.isArray(point.payload.detail_images)
      ? point.payload.detail_images.filter(Boolean)
      : [];
    if (!detailImages.length) return point;

    const extractedList = await mapWithConcurrency(detailImages, IMAGE_EXTRACTION_CONCURRENCY, async (url) => {
      try {
        const data = await extractImageData(url);
        console.log(`[image extracted] ${url}`);
        return { url, data };
      } catch (error) {
        console.warn(`[image extract skipped] ${url}`);
        console.warn(error?.message || error);
        return null;
      }
    });

    const successful = extractedList.filter(Boolean);
    const mergedBenefits = successful.flatMap((item) => item?.data?.benefits || []);
    const mergedIngredients = successful.flatMap((item) => item?.data?.ingredients || []);
    const mergedCautions = successful.flatMap((item) => item?.data?.cautions || []);
    const mergedInteractions = successful.flatMap((item) => item?.data?.interactions || []);
    const detailImageText = buildDetailImageText(successful);
    const existingSecondary = Array.isArray(point.payload?.secondary_benefits)
      ? point.payload.secondary_benefits
      : [];
    const combinedSecondary = Array.from(
      new Set([...existingSecondary, ...mergedBenefits].map((v) => (v || "").trim()).filter(Boolean)),
    );

    return {
      ...point,
      payload: {
        ...point.payload,
        detail_image_benefits: mergedBenefits,
        detail_image_ingredients: mergedIngredients,
        detail_image_cautions: mergedCautions,
        detail_image_interactions: mergedInteractions,
        detail_image_text: detailImageText,
        secondary_benefits: combinedSecondary,
      },
    };
  });

  return enriched;
}

// 포인트 임베딩 생성 후 Qdrant에 저장한다.
export async function FnInsertPoints() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS가 설정되지 않았습니다.");
  }
  console.log(`[start] preparing points for collection=${COLLECTION_NAME}`);
  const goodsItems = normalizeGoodsInput(goodsData);
  const sourceData = goodsItems.length
    ? goodsItems.map(mapGoodsToPoint)
    : dummyData;

  await collectNormalizationCandidates(sourceData);
  const withNameInsights = await enrichWithNameInsights(sourceData);
  const sourcePoints = await enrichWithImageData(withNameInsights);

  const texts = sourcePoints.map((item) => {
    const baseText = buildDocumentText(item);
    return baseText;
  });

  let pointsToUpsert = sourcePoints;

  try {
    console.log(`[embedding] creating dense vectors for ${texts.length} points`);
    const embeddings = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });
    if (embeddings?.usage) {
      logTokenUsage("embeddings", embeddings.usage, {
        items: texts.length,
      });
      usageStats.embeddings.requests += 1;
      usageStats.embeddings.input_tokens += embeddings.usage.prompt_tokens || 0;
      usageStats.embeddings.total_tokens += embeddings.usage.total_tokens || 0;
    }

    pointsToUpsert = sourcePoints.map((data, idx) => {
      const dense = embeddings.data[idx].embedding;
      const sparse = buildSparseVector(texts[idx]);
      return {
        ...data,
        vector: { dense, sparse },
      };
    });
  } catch (e) {
    console.error("[embedding failed]", e);
    if (e?.cause) console.error("[embedding failed cause]", e.cause);
    throw e;
  }

  console.log("[qdrant] upserting points");
  await qdrant.upsert(COLLECTION_NAME, {
    points: pointsToUpsert,
  });

  console.log(`포인트 저장 완료: collection=${COLLECTION_NAME}, count=${pointsToUpsert.length}`);
}
