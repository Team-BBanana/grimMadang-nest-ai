import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConversationService } from './conversation/conversation.service';
import { ConversationModule } from './conversation/conversation.module';
import { ConversationModule } from './conversation/conversation.module';
import { ConversationController } from './conversation/conversation.controller';
import { ConversationService } from './conversation/conversation.service';

@Module({
  imports: [ConversationModule],
  controllers: [AppController, ConversationController],
  providers: [AppService, ConversationService],
})
export class AppModule {}
