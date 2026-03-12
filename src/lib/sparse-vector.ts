const SPARSE_HASH_BUCKETS = 1 << 18;

function normalizeText(text?: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, ' and ')
    .replace(/[^0-9a-zA-Z가-힣\s]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text?: string): string[] {
  if (!text) return [];
  return normalizeText(text)
    .split(' ')
    .filter((token) => {
      if (!token) return false;
      if (/[a-z0-9]/i.test(token) && token.length < 2) return false;
      return true;
    });
}

function hashToken(token: string): number {
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
    const idx = hashToken(token) % SPARSE_HASH_BUCKETS;
    freq.set(idx, (freq.get(idx) || 0) + 1);
  });

  const entries = Array.from(freq.entries()).sort((a, b) => a[0] - b[0]);
  const indices: number[] = [];
  const values: number[] = [];
  let norm = 0;

  entries.forEach(([idx, tf]) => {
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
