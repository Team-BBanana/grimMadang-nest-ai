import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';
import { Topic, TopicSchema } from './schemas/topic.schema';
import { Conversation, ConversationSchema } from '../conversation/schemas/conversation.schema';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Topic.name, schema: TopicSchema },
      { name: Conversation.name, schema: ConversationSchema }
    ]),
    OpenAIModule
  ],
  controllers: [TopicsController],
  providers: [TopicsService],
})
export class TopicsModule {} 