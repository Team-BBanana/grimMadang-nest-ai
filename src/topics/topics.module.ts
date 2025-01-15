import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TopicsService } from './topics.service';
import { TopicsController } from './topics.controller';
import { OpenAIModule } from '../openai/openai.module';
import { AwsModule } from '../aws/aws.module';
import { Conversation, ConversationSchema } from '../conversation/schemas/conversation.schema';
import { TopicImage, TopicImageSchema } from './schemas/topic-image.schema';
import { DrawingGuide, DrawingGuideSchema } from './schemas/drawing-guide.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: TopicImage.name, schema: TopicImageSchema },
      { name: DrawingGuide.name, schema: DrawingGuideSchema }
    ]),
    OpenAIModule,
    AwsModule
  ],
  controllers: [TopicsController],
  providers: [TopicsService],
  exports: [TopicsService]
})
export class TopicsModule {} 