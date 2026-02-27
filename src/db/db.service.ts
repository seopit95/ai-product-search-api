import { ConflictException, Injectable } from '@nestjs/common';
import { FnCreateCollection, FnInsertPoints } from './db.tasks';

type JobName = 'create-collection' | 'insert-points';

@Injectable()
export class DbService {
  private readonly runningJobs = new Set<JobName>();

  async FnCreateCollection() {
    await this.FnRun('create-collection', async () => {
      await FnCreateCollection();
    });

    return {
      ok: true,
      action: 'create-collection',
      message: 'Collection created',
    };
  }

  async FnInsertPoints() {
    await this.FnRun('insert-points', async () => {
      await FnInsertPoints();
    });

    return {
      ok: true,
      action: 'insert-points',
      message: 'Points inserted',
    };
  }

  private async FnRun(name: JobName, task: () => Promise<void>) {
    if (this.runningJobs.has(name)) {
      throw new ConflictException(`Job already running: ${name}`);
    }

    this.runningJobs.add(name);
    try {
      await task();
    } finally {
      this.runningJobs.delete(name);
    }
  }
}
