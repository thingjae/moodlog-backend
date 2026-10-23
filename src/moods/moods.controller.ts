import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { MoodsService } from './moods.service.js';

@Controller('moods')
export class MoodsController {
  constructor(private readonly moods: MoodsService) {}

  @Get()
  findAll() {
    return this.moods.findAll();
  }

  @Post()
  create(@Body() body: { score?: unknown; emoji?: unknown; note?: unknown; day?: unknown }) {
    const { score, emoji, note = '', day = new Date().toISOString().slice(0, 10) } = body ?? {};
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      throw new BadRequestException('day must be YYYY-MM-DD');
    }
    if (!Number.isInteger(score) || (score as number) < 1 || (score as number) > 5) {
      throw new BadRequestException('score must be an integer from 1 to 5');
    }
    if (typeof emoji !== 'string' || !emoji || emoji.length > 16) {
      throw new BadRequestException('emoji is required');
    }
    if (typeof note !== 'string' || note.length > 500) {
      throw new BadRequestException('note must be a string up to 500 chars');
    }
    return this.moods.upsert({ score: score as number, emoji, note, day });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    this.moods.remove(id);
  }
}
