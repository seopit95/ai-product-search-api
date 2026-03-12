import { QdrantClient } from '@qdrant/js-client-rest';
import * as dotenv from 'dotenv';
import { normalizeQdrantUrl } from './qdrant-url';

dotenv.config();

const qdrantUrl = normalizeQdrantUrl(process.env.QDRANT_URL ?? process.env.DATABASE_URL);

export const qdrant = new QdrantClient({ url: qdrantUrl });
