import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DrawingGuideDocument = DrawingGuide & Document;

@Schema({ timestamps: true })
export class DrawingGuide {
  @Prop({ required: true })
  sessionId: string;

  @Prop({ required: true })
  topic: string;

  @Prop({ required: true })
  imageUrl: string;

  @Prop({ type: [Object], required: true })
  steps: {
    단계: number;
    타이틀: string;
    지시문장: string;
  }[];

  @Prop({ type: Object })
  evaluation?: {
    score: number;
    feedback: string;
  };
}

export const DrawingGuideSchema = SchemaFactory.createForClass(DrawingGuide); 