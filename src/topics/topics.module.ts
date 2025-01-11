import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';
// import { Topic, TopicSchema } from './schemas/topic.schema';
import { OpenAIModule } from '../openai/openai.module';
import { ConversationSchema } from '../conversation/schemas/conversation.schema';
import { AwsModule } from '../aws/aws.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      // { name: Topic.name, schema: TopicSchema },
      { name: 'Conversation', schema: ConversationSchema }
    ]),
    OpenAIModule,
    AwsModule
  ],
  controllers: [TopicsController],
  providers: [TopicsService],
  exports: [TopicsService]
})
export class TopicsModule {} 