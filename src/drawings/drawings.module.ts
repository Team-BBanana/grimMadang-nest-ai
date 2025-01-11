import { Module } from '@nestjs/common';
import { DrawingsController } from './drawings.controller';
import { DrawingsService } from './drawings.service';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [OpenAIModule],
  controllers: [DrawingsController],
  providers: [DrawingsService],
  exports: [DrawingsService]
})
export class DrawingsModule {} 