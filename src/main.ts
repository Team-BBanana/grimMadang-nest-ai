import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as compression from 'compression';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 압축 미들웨어 추가
  app.use(compression());

  // JSON 크기 제한 설정
  app.use(json({ limit: '50mb' }));

  // CORS 설정 - credentials 활성화
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8080',
      'http://192.168.137.1:5173'
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 3600
  });

  // Global prefix 설정
  app.setGlobalPrefix('api');

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('그림마당 AI API')
    .setDescription('노인 사용자를 위한 AI 기반 대화 및 그림 그리기 서비스 API')
    .setVersion('1.0')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // 모든 IP에서 접근 가능하도록 설정
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
  
  const url = await app.getUrl();
  console.log(`Application is running on: ${url}`);
}
bootstrap();

