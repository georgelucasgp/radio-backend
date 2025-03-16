import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Configurar limites de tamanho do payload
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

  // Configuração do CORS
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS || 'http://localhost:3001'
  )
    .split(',')
    .map((origin) => origin.trim());

  logger.log(
    `Configurando CORS para os domínios: ${allowedOrigins.join(', ')}`,
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    maxAge: 86400,
  });

  const port = process.env.PORT ?? 3000;
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);
  logger.log(`Aplicação rodando em: http://${host}:${port}`);
}

bootstrap();
