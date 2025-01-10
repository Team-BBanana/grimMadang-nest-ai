import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DrawingsController } from './drawings.controller';
import { DrawingsService } from './drawings.service';
import { Drawing, DrawingSchema } from './schemas/drawing.schema';
import { OpenAIModule } from '../openai/openai.module';
import { AwsModule } from '../aws/aws.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Drawing.name, schema: DrawingSchema }
    ]),
    OpenAIModule,
    AwsModule
  ],
  controllers: [DrawingsController],
  providers: [DrawingsService],
  exports: [DrawingsService]
})
export class DrawingsModule {} 