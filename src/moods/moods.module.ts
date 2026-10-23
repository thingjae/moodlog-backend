import { Module } from '@nestjs/common';
import { MoodsController } from './moods.controller.js';
import { MoodsService } from './moods.service.js';

@Module({
  controllers: [MoodsController],
  providers: [MoodsService],
})
export class MoodsModule {}
