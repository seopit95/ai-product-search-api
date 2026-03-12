export function normalizeQdrantUrl(rawUrl?: string): string {
  if (!rawUrl || rawUrl.trim().length === 0) {
    throw new Error(
      'Qdrant URL is not set. Configure QDRANT_URL (preferred) or DATABASE_URL in your .env file.',
    );
  }

  const trimmed = rawUrl.trim();
  const hasExplicitScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const withProtocol = hasExplicitScheme ? trimmed : `http://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error(
      `Invalid Qdrant URL "${trimmed}". Use a valid HTTP(S) URL such as "http://localhost:6333".`,
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Invalid Qdrant URL protocol "${parsed.protocol}". Qdrant requires "http://" or "https://".`,
    );
  }

  if (!parsed.hostname) {
    throw new Error(
      `Invalid Qdrant URL "${trimmed}". Missing hostname (example: "http://localhost:6333").`,
    );
  }

  return parsed.toString();
}
