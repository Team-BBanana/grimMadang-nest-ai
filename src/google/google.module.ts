import { Module } from '@nestjs/common';
import { GoogleSpeechService } from './google-speech.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [GoogleSpeechService],
  exports: [GoogleSpeechService],
})
export class GoogleModule {}