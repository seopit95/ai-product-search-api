import { Module } from '@nestjs/common';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { DbController } from './db/db.controller';
import { DbService } from './db/db.service';

@Module({
  imports: [],
  controllers: [ChatController, DbController],
  providers: [ChatService, DbService],
})
export class AppModule {}
