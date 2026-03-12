import { Body, Controller, Post } from '@nestjs/common';
import { ChatService } from './chat.service';

type ChatRequestBody = {
  message?: string;
  sessionId?: string;
};

@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('chat')
  async chat(@Body() body: ChatRequestBody) {
    return this.chatService.FnHandleChat(body);
  }
}
