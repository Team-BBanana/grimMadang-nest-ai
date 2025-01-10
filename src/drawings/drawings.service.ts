import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Drawing, DrawingDocument } from './schemas/drawing.schema';
import { OpenAIService } from '../openai/openai.service';
import { S3Service } from '../aws/s3.service';

@Injectable()
export class DrawingsService {
  private readonly logger = new Logger(DrawingsService.name);

  constructor(
    @InjectModel(Drawing.name)
    private drawingModel: Model<DrawingDocument>,
    private readonly openAIService: OpenAIService,
    private readonly s3Service: S3Service
  ) {}

  // 추후 메서드들이 여기에 추가될 예정
} 