import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('그림마당 AI API')
    .setDescription('노인 사용자를 위한 AI 기반 대화 및 그림 그리기 서비스 API')
    .setVersion('1.0')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // CORS 설정
  app.enableCors({
    origin: 'http://localhost:5173', // 특정 도메인만 허용
    credentials: true, // 자격 증명 허용
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
