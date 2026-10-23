import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 쉼표로 여러 주소를 허용할 수 있고, 끝의 '/'는 무시한다.
  const origins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  app.enableCors({ origin: origins });
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
