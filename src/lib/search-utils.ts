import { readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_BRAND_SYNONYMS: Record<string, string[]> = {
  'Lock&Lock': ['락앤락', 'locknlock', 'lock&lock'],
};

const DEFAULT_BRAND_MAP = new Map<string, string>([
  ['락앤락', 'Lock&Lock'],
  ['locknlock', 'Lock&Lock'],
  ['lock&lock', 'Lock&Lock'],
]);

const DEFAULT_CATEGORY_SYNONYMS: Record<string, string[]> = {
  밀폐용기: ['반찬통', '보관용기', '식재료통', '음식보관'],
  텀블러: ['보온컵', '보냉컵', '휴대컵', '텀블러컵'],
  보온병: ['보냉병', '물통', '텀블러'],
  도시락: ['도시락통', '런치박스', '도시락용기'],
  물병: ['물통', '보틀'],
  프라이팬: ['후라이팬', '팬', '코팅팬'],
  냄비: ['스텐냄비', '조리냄비', '냄비세트'],
  주방소형가전: ['주방가전', '소형가전', '주방전기'],
};

const DEFAULT_CATEGORY_ALIAS = new Map<string, string>([
  ['후라이팬', '프라이팬'],
  ['프라이팬', '프라이팬'],
  ['팬', '프라이팬'],
  ['텀블러', '텀블러'],
  ['보온컵', '텀블러'],
  ['보냉컵', '텀블러'],
  ['보온병', '보온병'],
  ['보냉병', '보온병'],
  ['도시락', '도시락'],
  ['도시락통', '도시락'],
  ['물병', '물병'],
  ['물통', '물병'],
  ['밀폐용기', '밀폐용기'],
  ['반찬통', '밀폐용기'],
  ['전기포트', '주방소형가전'],
  ['전기주전자', '주방소형가전'],
  ['토스터기', '주방소형가전'],
  ['에어프라이어', '주방소형가전'],
  ['블렌더', '주방소형가전'],
  ['전기밥솥', '주방소형가전'],
  ['전기그릴', '주방소형가전'],
  ['커피메이커', '주방소형가전'],
  ['멀티쿠커', '주방소형가전'],
  ['전기찜기', '주방소형가전'],
]);

const NORMALIZE_REPLACEMENTS = [
  ['전자렌지', '전자레인지'],
  ['렌지', '레인지'],
] as const;

const SPARSE_HASH_BUCKETS = 1 << 18;

type NormalizationJson = {
  brand_synonyms?: Record<string, string[]>;
  brand_alias?: Record<string, string>;
  category_synonyms?: Record<string, string[]>;
  category_alias?: Record<string, string>;
};

function FnLoadNormalization(): NormalizationJson | null {
  try {
    const filePath = path.resolve(process.cwd(), 'data', 'normalization.json');
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as NormalizationJson;
  } catch {
    return null;
  }
}

const AUTO_NORMALIZATION = FnLoadNormalization();
const BRAND_SYNONYMS = AUTO_NORMALIZATION?.brand_synonyms || DEFAULT_BRAND_SYNONYMS;
const BRAND_MAP = AUTO_NORMALIZATION?.brand_alias
  ? new Map(Object.entries(AUTO_NORMALIZATION.brand_alias))
  : DEFAULT_BRAND_MAP;
const CATEGORY_SYNONYMS = AUTO_NORMALIZATION?.category_synonyms || DEFAULT_CATEGORY_SYNONYMS;
const CATEGORY_ALIAS = AUTO_NORMALIZATION?.category_alias
  ? new Map(Object.entries(AUTO_NORMALIZATION.category_alias))
  : DEFAULT_CATEGORY_ALIAS;

export function normalizeText(text?: string): string {
  if (!text) return '';
  let out = text;
  NORMALIZE_REPLACEMENTS.forEach(([from, to]) => {
    out = out.replaceAll(from, to);
  });
  return out
    .replace(/&/g, ' and ')
    .replace(/[^0-9a-zA-Z가-힣\s]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text?: string): string[] {
  if (!text) return [];
  const tokens = normalizeText(text).split(' ');
  return tokens.filter((token) => {
    if (!token) return false;
    if (/[a-z0-9]/i.test(token) && token.length < 2) return false;
    return true;
  });
}

function FnHashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildSparseVector(text: string): { indices: number[]; values: number[] } {
  const tokens = tokenize(text);
  const freq = new Map<number, number>();
  tokens.forEach((token) => {
    const idx = FnHashToken(token) % SPARSE_HASH_BUCKETS;
    freq.set(idx, (freq.get(idx) || 0) + 1);
  });

  const indices: number[] = [];
  const values: number[] = [];
  let norm = 0;

  [...freq.entries()].sort((a, b) => a[0] - b[0]).forEach(([idx, tf]) => {
    const value = 1 + Math.log(tf);
    indices.push(idx);
    values.push(value);
    norm += value * value;
  });

  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < values.length; i += 1) {
    values[i] /= norm;
  }

  return { indices, values };
}

export function normalizeBrand(brand?: string | null): string | null {
  if (!brand) return null;
  const raw = normalizeText(brand).replace(/\s+/g, '');
  return BRAND_MAP.get(raw) || brand;
}

export function normalizeCategory(category?: string | null): string | null {
  if (!category) return null;
  const raw = normalizeText(category);
  return CATEGORY_ALIAS.get(raw) || category;
}

function FnExpandQueryText(text: string, filters: Record<string, unknown>): string {
  const baseTokens = new Set(tokenize(text));
  const extras = new Set<string>();

  const addAll = (arr?: string[]) => {
    if (!arr) return;
    arr.forEach((token) => {
      const t = normalizeText(token);
      if (t && !baseTokens.has(t)) extras.add(t);
    });
  };

  const category = typeof filters?.category === 'string' ? filters.category : null;
  const brand = typeof filters?.brand === 'string' ? filters.brand : null;

  if (category) addAll(CATEGORY_SYNONYMS[category]);
  if (brand && BRAND_SYNONYMS[brand]) addAll(BRAND_SYNONYMS[brand]);

  baseTokens.forEach((token) => {
    const normalizedCategory = CATEGORY_ALIAS.get(token);
    if (normalizedCategory) {
      addAll([normalizedCategory, ...(CATEGORY_SYNONYMS[normalizedCategory] || [])]);
    }
  });

  if (!extras.size) return text;
  return `${text} ${Array.from(extras).join(' ')}`.trim();
}

export function buildQueryText(params: {
  semantic_query: string;
  filters: Record<string, unknown>;
  userMessage: string;
}): string {
  const { semantic_query, filters, userMessage } = params;
  const base = normalizeText(`${semantic_query} ${userMessage}`);
  const expanded = FnExpandQueryText(base, filters);
  const brand = filters?.brand ? `브랜드: ${String(filters.brand)}` : '';
  const category = filters?.category ? `카테고리: ${String(filters.category)}` : '';

  const minPrice = typeof filters?.min_price === 'number' ? filters.min_price : null;
  const maxPrice = typeof filters?.max_price === 'number' ? filters.max_price : null;
  const price = (minPrice !== null || maxPrice !== null)
    ? `가격: ${minPrice ?? ''}-${maxPrice ?? ''}`
    : '';

  return `
상품명: ${expanded}
설명: ${base}
${brand}
${category}
${price}
  `.trim();
}

export function buildDocumentText(item: any): string {
  const payload = item?.payload || {};
  const detailImageText = payload?.detail_image_text || '';

  return `
상품명: ${payload.name || ''}
브랜드: ${payload.brand || ''}
카테고리: ${payload.category || ''}
가격: ${payload.price || ''}
설명: ${payload.description || ''}
대표성분: ${payload.primary_ingredient || ''}
효능요약: ${payload.effects_summary || ''}
부수효능: ${(payload.secondary_benefits || []).join(' ')}
추천대상: ${(payload.recommended_for || []).join(' ')}
비추천대상: ${(payload.not_recommended_for || []).join(' ')}
주의사항: ${payload.notes || ''}
상세이미지텍스트: ${detailImageText}
  `.trim();
}
