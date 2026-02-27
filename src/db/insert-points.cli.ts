import { FnInsertPoints } from './db.tasks';

FnInsertPoints().catch((error) => {
  console.error('[FnInsertPoints failed]', error);
  if (error?.cause) console.error('[FnInsertPoints failed cause]', error.cause);
  process.exit(1);
});
