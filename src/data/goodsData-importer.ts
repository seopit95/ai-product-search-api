import { FnNormalizeRichTextHtml } from '../lib/rich-text-html';

export type RawGoodsItem = {
  goodsNo?: unknown;
  goodsNm?: unknown;
  cateNm?: unknown;
  goodsPrice?: unknown;
  goodsDescription?: unknown;
  imageUrl?: unknown;
};

export type GoodsDataItem = {
  goodsNo: string;
  goodsNm: string;
  cateNm: string;
  goodsPrice: string;
  goodsDescription: string;
  imageUrl: string;
};

type ImageBlock = {
  comment: string | null;
  src: string;
};

function FnToText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function FnNormalizeRawGoodsItem(input: unknown): RawGoodsItem | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  return input as RawGoodsItem;
}

function FnSanitizeGoodsName(name: string): string {
  let out = FnToText(name);

  out = out.replace(/^\s*(?:\[[^\]]+\]|\([^)]+\)|★[^★]+★|☆[^☆]+☆)\s*/u, '');
  out = out.replace(/\s*(?:\[[^\]]+\]|\([^)]+\))\s*$/u, '');
  out = out.replace(/[★☆]+/gu, ' ');
  out = out.replace(/\s+/gu, ' ').trim();

  return out || '상품';
}

function FnSimplifyCommentLabel(comment: string | null): string {
  let out = FnToText(comment);
  if (!out) return '';

  [
    '상세페이지',
    '상세 페이지',
    '상세설명',
    '상세 설명',
    '영양정보',
    '제품공지',
    '제품 공지',
    '공지',
    '배너',
    '설명',
    '영양',
    '상세',
    '분할',
    '전체',
  ].forEach((token) => {
    out = out.replaceAll(token, ' ');
  });

  out = out.replace(/[+/_-]+/gu, ' ');
  out = out.replace(/\s+/gu, ' ').trim();

  return out;
}

function FnExtractImageBlocks(descriptionHtml: string): ImageBlock[] {
  const html = FnNormalizeRichTextHtml(FnToText(descriptionHtml));
  if (!html) return [];

  const regex = /(?:<!--([\s\S]*?)-->\s*)?<img[^>]+src=["']([^"']+)["'][^>]*>/giu;
  const blocks: ImageBlock[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const src = FnToText(match[2]);
    if (!src || seen.has(src)) continue;
    seen.add(src);
    blocks.push({
      comment: FnToText(match[1]) || null,
      src,
    });
    if (blocks.length >= 3) break;
  }

  return blocks;
}

function FnBuildDescriptionSummary(goodsNm: string, blocks: ImageBlock[]): string {
  const baseName = FnSanitizeGoodsName(goodsNm);
  const labels = Array.from(
    new Set(blocks.map((block) => FnSimplifyCommentLabel(block.comment)).filter(Boolean)),
  );

  if (labels.length === 0) {
    return `${baseName} 제품으로 상세 이미지를 포함합니다.`;
  }

  if (labels.length === 1) {
    return `${baseName} 제품으로 ${labels[0]} 관련 상세 이미지를 포함합니다.`;
  }

  return `${baseName} 제품으로 ${labels[0]}와 ${labels[1]} 관련 상세 이미지를 포함합니다.`;
}

function FnBuildGoodsDescription(goodsNm: string, descriptionHtml: string): string {
  const blocks = FnExtractImageBlocks(descriptionHtml);
  const lines = [FnBuildDescriptionSummary(goodsNm, blocks)];

  blocks.forEach((block) => {
    if (block.comment) {
      lines.push(`<!--${block.comment}-->`);
    }
    lines.push(`<img src="${block.src}">`);
  });

  return lines.join('\r\n');
}

export function FnNormalizeGoodsImportInput(input: unknown): RawGoodsItem[] {
  if (Array.isArray(input)) {
    return input.map(FnNormalizeRawGoodsItem).filter(Boolean) as RawGoodsItem[];
  }

  if (input && typeof input === 'object') {
    const result = (input as { result?: unknown }).result;
    if (Array.isArray(result)) {
      return result.map(FnNormalizeRawGoodsItem).filter(Boolean) as RawGoodsItem[];
    }

    const item = FnNormalizeRawGoodsItem(input);
    return item ? [item] : [];
  }

  return [];
}

function FnConvertGoodsItem(item: RawGoodsItem): GoodsDataItem {
  const goodsNm = FnToText(item.goodsNm);

  return {
    goodsNo: FnToText(item.goodsNo),
    goodsNm,
    cateNm: FnToText(item.cateNm),
    goodsPrice: FnToText(item.goodsPrice),
    goodsDescription: FnBuildGoodsDescription(goodsNm, FnToText(item.goodsDescription)),
    imageUrl: FnToText(item.imageUrl),
  };
}

export function FnConvertGoodsImportPayload(input: unknown): GoodsDataItem[] {
  return FnNormalizeGoodsImportInput(input).map(FnConvertGoodsItem);
}

export function FnBuildGoodsDataModuleSource(items: GoodsDataItem[]): string {
  return `export const goodsData = ${JSON.stringify(items, null, 2)};\n`;
}
