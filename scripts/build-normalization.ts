import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const NORMALIZE_REPLACEMENTS = [
  ['전자렌지', '전자레인지'],
  ['렌지', '레인지'],
] as const;

function FnNormalizeText(text: string): string {
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

function FnNormalizeBrandKey(brand: string): string {
  return FnNormalizeText(brand).replace(/\s+/g, '');
}

function FnNormalizeCategoryKey(category: string): string {
  return FnNormalizeText(category);
}

function FnPickCanonical(variantsMap: Map<string, number>): string {
  const entries = Array.from(variantsMap.entries());
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    if (b[0].length !== a[0].length) return b[0].length - a[0].length;
    return a[0].localeCompare(b[0], 'ko');
  });
  return entries[0]?.[0] || '';
}

async function FnBuildNormalization() {
  const dataDir = path.resolve('data');
  const candidatesPath = path.join(dataDir, 'normalization-candidates.jsonl');
  const outputPath = path.join(dataDir, 'normalization.json');

  if (!existsSync(candidatesPath)) {
    console.log('[normalization] no candidates file found. Skipping.');
    return;
  }

  const raw = readFileSync(candidatesPath, 'utf8');
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);

  const brandVariants = new Map<string, Map<string, number>>();
  const categoryVariants = new Map<string, Map<string, number>>();

  lines.forEach((line) => {
    try {
      const item = JSON.parse(line) as { type?: string; value?: string };
      if (item?.type === 'brand' && typeof item.value === 'string' && item.value.trim()) {
        const rawValue = item.value.trim();
        const key = FnNormalizeBrandKey(rawValue);
        if (!key) return;
        if (!brandVariants.has(key)) brandVariants.set(key, new Map());
        const bucket = brandVariants.get(key)!;
        bucket.set(rawValue, (bucket.get(rawValue) || 0) + 1);
      }

      if (item?.type === 'category' && typeof item.value === 'string' && item.value.trim()) {
        const rawValue = item.value.trim();
        const key = FnNormalizeCategoryKey(rawValue);
        if (!key) return;
        if (!categoryVariants.has(key)) categoryVariants.set(key, new Map());
        const bucket = categoryVariants.get(key)!;
        bucket.set(rawValue, (bucket.get(rawValue) || 0) + 1);
      }
    } catch {
      // skip invalid line
    }
  });

  const brand_alias: Record<string, string> = {};
  const category_alias: Record<string, string> = {};
  const brand_synonyms: Record<string, string[]> = {};
  const category_synonyms: Record<string, string[]> = {};

  const brands: string[] = [];
  brandVariants.forEach((variantsMap, key) => {
    const canonical = FnPickCanonical(variantsMap);
    if (!canonical) return;
    brand_alias[key] = canonical;
    brands.push(canonical);

    const synonyms = Array.from(variantsMap.keys())
      .filter((v) => v !== canonical)
      .sort((a, b) => (variantsMap.get(b) || 0) - (variantsMap.get(a) || 0));
    if (synonyms.length) brand_synonyms[canonical] = synonyms;
  });

  const categories: string[] = [];
  categoryVariants.forEach((variantsMap, key) => {
    const canonical = FnPickCanonical(variantsMap);
    if (!canonical) return;
    category_alias[key] = canonical;
    categories.push(canonical);

    const synonyms = Array.from(variantsMap.keys())
      .filter((v) => v !== canonical)
      .sort((a, b) => (variantsMap.get(b) || 0) - (variantsMap.get(a) || 0));
    if (synonyms.length) category_synonyms[canonical] = synonyms;
  });

  brands.sort((a, b) => a.localeCompare(b, 'ko'));
  categories.sort((a, b) => a.localeCompare(b, 'ko'));

  const output = {
    generated_at: new Date().toISOString(),
    brands,
    categories,
    brand_alias,
    category_alias,
    brand_synonyms,
    category_synonyms,
  };

  await mkdir(dataDir, { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`[normalization] generated: ${outputPath}`);
  console.log(`[normalization] brands=${brands.length}, categories=${categories.length}`);
}

FnBuildNormalization().catch((error) => {
  console.error('[normalization] failed', error);
  process.exit(1);
});
