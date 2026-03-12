export type SearchFilters = {
  brand?: string | null;
  category?: string | null;
  min_price?: number | null;
  max_price?: number | null;
};

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function toPriceText(filters: SearchFilters): string {
  const minPrice = typeof filters.min_price === 'number' ? filters.min_price : null;
  const maxPrice = typeof filters.max_price === 'number' ? filters.max_price : null;
  if (minPrice === null && maxPrice === null) return '';
  return `가격: ${minPrice ?? ''}-${maxPrice ?? ''}`;
}

export function buildChatQueryText(params: {
  semanticQuery: string;
  filters: SearchFilters;
  userMessage: string;
}): string {
  const semanticQuery = toText(params.semanticQuery);
  const userMessage = toText(params.userMessage);
  const brand = toText(params.filters?.brand);
  const category = toText(params.filters?.category);
  const price = toPriceText(params.filters || {});

  return [
    semanticQuery ? `의미질의: ${semanticQuery}` : '',
    userMessage ? `원문질의: ${userMessage}` : '',
    brand ? `브랜드: ${brand}` : '',
    category ? `카테고리: ${category}` : '',
    price,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildProductDocumentText(item: any): string {
  const payload = item?.payload || {};
  const secondaryBenefits = toList(payload.secondary_benefits).join(' ');
  const recommendedFor = toList(payload.recommended_for).join(' ');
  const notRecommendedFor = toList(payload.not_recommended_for).join(' ');
  const detailImageText = toText(payload.detail_image_text);

  return [
    `상품명: ${toText(payload.name)}`,
    `브랜드: ${toText(payload.brand)}`,
    `카테고리: ${toText(payload.category)}`,
    `가격: ${payload.price ?? ''}`,
    `설명: ${toText(payload.description)}`,
    `대표성분: ${toText(payload.primary_ingredient)}`,
    `효능요약: ${toText(payload.effects_summary)}`,
    `부수효능: ${secondaryBenefits}`,
    `추천대상: ${recommendedFor}`,
    `비추천대상: ${notRecommendedFor}`,
    `주의사항: ${toText(payload.notes)}`,
    `상세이미지텍스트: ${detailImageText}`,
  ].join('\n');
}
