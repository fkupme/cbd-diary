import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { createApiResponse } from '../../common/helpers/response.helper';
import { ChatService } from './chat.service';

@ApiTags('chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  private extractUserId(req: Request): string {
    const user: any = (req as any).user;
    if (user?.id) return user.id;
    if (user?.sub) return user.sub;
    throw new Error('Unauthorized: unable to determine user id');
  }

  @Post('entries/:entryId')
  @ApiOperation({
    summary: 'Создать чат для записи (или получить существующий)',
  })
  @ApiParam({ name: 'entryId', description: 'ID записи' })
  async createOrGetChat(
    @Req() req: Request,
    @Param('entryId') entryId: string,
  ) {
    const userId = this.extractUserId(req);
    const chat = await this.chatService.getOrCreateChat(userId, entryId);
    return createApiResponse(chat, req.url);
  }

  @Get('entries/:entryId')
  @ApiOperation({ summary: 'Получить чат по записи' })
  @ApiParam({ name: 'entryId', description: 'ID записи' })
  async getChatByEntry(@Req() req: Request, @Param('entryId') entryId: string) {
    const userId = this.extractUserId(req);
    const chat = await this.chatService.getChatByEntry(userId, entryId);
    return createApiResponse(chat, req.url);
  }

  @Get(':chatId/messages')
  @ApiOperation({ summary: 'Список сообщений чата' })
  async listMessages(@Req() req: Request, @Param('chatId') chatId: string) {
    const userId = this.extractUserId(req);
    const messages = await this.chatService.listMessages(userId, chatId);
    return createApiResponse(messages, req.url);
  }

  @Post(':chatId/messages')
  @ApiOperation({ summary: 'Отправить сообщение в чат' })
  @ApiBody({ schema: { example: { role: 'USER', content: 'Привет' } } })
  async postMessage(
    @Req() req: Request,
    @Param('chatId') chatId: string,
    @Body() body: { role?: 'USER' | 'AI' | 'SYSTEM'; content: string },
  ) {
    const userId = this.extractUserId(req);
    const role = body.role || 'USER';
    const msg = await this.chatService.addMessage(
      userId,
      chatId,
      role,
      body.content,
    );
    return createApiResponse(msg, req.url);
  }

  @Post(':chatId/finalize')
  @ApiOperation({ summary: 'Финализировать чат (SESSION_END JSON)' })
  @ApiBody({
    schema: {
      example: {
        beliefs: [
          {
            beliefId: 'b_123',
            text: 'Я должен быть идеальным...',
            confidenceModel: 0.82,
          },
        ],
        distortions: [{ type: 'all_or_nothing', confidence: 0.7 }],
        dispute: { proposed: 'континуум', user_agreed: true },
        balanced_thought: 'Ошибки не обнуляют мою ценность.',
        next_steps: ['3 кейса достаточно хорошо'],
        outcome: 'agreed',
        finalized: true,
        relatedEntryId: 'cbt_entry_uuid',
      },
    },
  })
  async finalize(
    @Req() req: Request,
    @Param('chatId') chatId: string,
    @Body()
    body: any,
  ) {
    const userId = this.extractUserId(req);
    const result = await this.chatService.finalizeChat(userId, chatId, body);
    return createApiResponse(result, req.url);
  }
}
