import * as dotenv from 'dotenv';
import { qdrant } from '../src/lib/qdrant';

dotenv.config();

async function FnCreateCollection() {
  const collectionName = process.env.COLLECTION_NAME || 'test_products';
  await qdrant.createCollection(collectionName, {
    vectors: {
      dense: {
        size: 1536,
        distance: 'Cosine',
      },
    },
    sparse_vectors: {
      sparse: {},
    },
  });

  console.log(`컬렉션 생성 완료: ${collectionName}`);
}

FnCreateCollection().catch((error) => {
  console.error(error);
  process.exit(1);
});
