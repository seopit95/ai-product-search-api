import { Controller, Post } from '@nestjs/common';
import { DbService } from './db.service';

@Controller('db')
export class DbController {
  constructor(private readonly dbService: DbService) {}

  @Post('create-collection')
  async createCollection() {
    return this.dbService.FnCreateCollection();
  }

  @Post('insert-points')
  async insertPoints() {
    return this.dbService.FnInsertPoints();
  }
}
