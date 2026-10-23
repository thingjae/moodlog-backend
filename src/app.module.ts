import { Module } from '@nestjs/common';
import { MoodsModule } from './moods/moods.module.js';

@Module({
  imports: [MoodsModule],
})
export class AppModule {}
