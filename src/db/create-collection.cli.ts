import { FnCreateCollection } from './db.tasks';

FnCreateCollection().catch((error) => {
  console.error(error);
  process.exit(1);
});
