import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConversationModule } from './conversation/conversation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ConversationModule,
  ],
})
export class AppModule {}
