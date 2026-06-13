import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { createApiResponse } from '../../common/helpers/response.helper';
import { IntakeService } from './intake.service';

@ApiTags('intake')
@ApiBearerAuth('JWT-auth')
@Controller('intake')
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  private extractUserId(req: Request): string {
    const user: any = (req as any).user;
    if (user?.id) return user.id;
    if (user?.sub) return user.sub;
    throw new Error('Unauthorized: unable to determine user id');
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Начать сессию голосового захвата события' })
  async start(@Req() req: Request) {
    const userId = this.extractUserId(req);
    const session = await this.intake.startSession(userId);
    return createApiResponse(session, req.url);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Сессия целиком (статус, события, сообщения)' })
  @ApiParam({ name: 'id', description: 'ID сессии' })
  async get(@Req() req: Request, @Param('id') id: string) {
    const userId = this.extractUserId(req);
    const data = await this.intake.getSession(userId, id);
    return createApiResponse(data, req.url);
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: 'Сообщения сессии' })
  @ApiParam({ name: 'id', description: 'ID сессии' })
  async messages(@Req() req: Request, @Param('id') id: string) {
    const userId = this.extractUserId(req);
    const msgs = await this.intake.listMessages(userId, id);
    return createApiResponse(msgs, req.url);
  }

  @Post('sessions/:id/transcribe')
  @ApiOperation({ summary: 'Расшифровать аудио (base64) в текст' })
  @ApiParam({ name: 'id', description: 'ID сессии' })
  async transcribe(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { audioBase64: string; mimeType: string },
  ) {
    const userId = this.extractUserId(req);
    const data = await this.intake.transcribe(
      userId,
      id,
      body.audioBase64,
      body.mimeType,
    );
    return createApiResponse(data, req.url);
  }

  @Post('sessions/:id/transcript')
  @ApiOperation({ summary: 'Задать/исправить транскрипт вручную' })
  @ApiParam({ name: 'id', description: 'ID сессии' })
  async transcript(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { transcript: string },
  ) {
    const userId = this.extractUserId(req);
    const data = await this.intake.setTranscript(userId, id, body.transcript);
    return createApiResponse(data, req.url);
  }

  @Post('sessions/:id/segment')
  @ApiOperation({ summary: 'Разбить транскрипт на ситуации (кандидаты)' })
  @ApiParam({ name: 'id', description: 'ID сессии' })
  async segment(@Req() req: Request, @Param('id') id: string) {
    const userId = this.extractUserId(req);
    const data = await this.intake.segment(userId, id);
    return createApiResponse(data, req.url);
  }

  @Post('sessions/:id/select')
  @ApiOperation({ summary: 'Выбрать ситуации для разбора' })
  @ApiParam({ name: 'id', description: 'ID сессии' })
  async select(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { selectedIds: string[] },
  ) {
    const userId = this.extractUserId(req);
    const data = await this.intake.selectEvents(
      userId,
      id,
      body.selectedIds || [],
    );
    return createApiResponse(data, req.url);
  }

  @Post('sessions/:id/answer')
  @ApiOperation({
    summary: 'Ответ на текущий вопрос интервью (текст/эмоции/интенсивность)',
  })
  @ApiParam({ name: 'id', description: 'ID сессии' })
  async answer(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    body: {
      text?: string;
      emotions?: { emotionId: number; intensity: number }[];
    },
  ) {
    const userId = this.extractUserId(req);
    const data = await this.intake.answer(userId, id, body);
    return createApiResponse(data, req.url);
  }

  @Post('sessions/:id/commit')
  @ApiOperation({ summary: 'Сохранить выбранные ситуации как записи дневника' })
  @ApiParam({ name: 'id', description: 'ID сессии' })
  async commit(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { selectedEventIds?: string[] },
  ) {
    const userId = this.extractUserId(req);
    const data = await this.intake.commit(userId, id, body?.selectedEventIds);
    return createApiResponse(data, req.url);
  }
}
