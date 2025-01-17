// 📦 NestJS의 모듈 데코레이터 임포트
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
// 🎮 대화 흐름을 제어하는 컨트롤러 클래스 임포트
import { ConversationController } from './conversation.controller';
// 💼 대화 관련 비즈니스 로직을 처리하는 서비스 클래스 임포트
import { ConversationService } from './conversation.service';
// 🤖 OpenAI 기능을 사용하기 위한 모듈 임포트
import { OpenAIModule } from '../openai/openai.module';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { GoogleModule } from '../google/google.module';
import { TopicImage, TopicImageSchema } from '../topics/schemas/topic-image.schema';

// 🎯 대화 관련 기능을 모듈로 묶어서 관리
@Module({
  // 🔗 OpenAI 기능을 사용하기 위해 OpenAIModule을 가져오기
  imports: [
    OpenAIModule,
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: TopicImage.name, schema: TopicImageSchema },
    ]),
    GoogleModule,
  ],
  // 🎮 HTTP 요청을 처리할 컨트롤러 등록
  controllers: [ConversationController],
  // 💫 비즈니스 로직을 처리할 서비스 프로바이더 등록
  providers: [ConversationService]
})
export class ConversationModule {}
