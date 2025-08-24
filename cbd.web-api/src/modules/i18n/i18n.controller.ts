import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { I18nService } from './i18n.service';

@Controller('i18n')
export class I18nController {
  constructor(private readonly i18n: I18nService) {}

  @Public()
  @Get(':lang')
  async getLang(@Param('lang') lang: string) {
    return this.i18n.getTranslations(lang);
  }

  @Public()
  @Post(':lang')
  async upsertLang(
    @Param('lang') lang: string,
    @Body() payload: Record<string, string>,
  ) {
    const n = await this.i18n.upsertTranslations(lang, payload);
    return { updated: n };
  }
}
