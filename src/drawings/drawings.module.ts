import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DrawingsService } from './drawings.service';
import { DrawingsController } from './drawings.controller';
import { OpenAIModule } from '../openai/openai.module';
import { DrawingGuide, DrawingGuideSchema } from '../topics/schemas/drawing-guide.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DrawingGuide.name, schema: DrawingGuideSchema }
    ]),
    OpenAIModule
  ],
  controllers: [DrawingsController],
  providers: [DrawingsService]
})
export class DrawingsModule {} 