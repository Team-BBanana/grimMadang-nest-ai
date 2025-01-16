import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import { Logger } from '@nestjs/common';
import * as net from 'net';

// 포트 사용 가능 여부 확인 함수
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        server.close();
        resolve(true);
      })
      .listen(port);
  });
}

// 사용 가능한 포트 찾기
async function findAvailablePort(startPort: number): Promise<number> {
  const logger = new Logger('PortFinder');
  let port = startPort;
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortAvailable(port)) {
      return port;
    }
    logger.warn(`포트 ${port}가 사용 중입니다. 다음 포트 시도...`);
    port++;
  }

  throw new Error('사용 가능한 포트를 찾을 수 없습니다.');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // body-parser 설정 - 요청 크기 제한 증가
  app.use(bodyParser.json({limit: '50mb'}));
  app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
  app.use(bodyParser.raw({limit: '50mb', type: 'audio/wav'}));

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
    origin: 'http://localhost:5173',
    credentials: true,
  });

  // 포트 설정 및 서버 시작
  const preferredPort = parseInt(process.env.PORT || '3000', 10);
  try {
    const port = await findAvailablePort(preferredPort);
    await app.listen(port);
    logger.log(`서버가 포트 ${port}에서 시작되었습니다.`);
  } catch (error) {
    logger.error('서버 시작 실패:', error.message);
    process.exit(1);
  }
}

bootstrap();
