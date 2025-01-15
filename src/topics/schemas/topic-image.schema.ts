import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TopicImageDocument = TopicImage & Document;

@Schema({ timestamps: true })
export class TopicImage {
  @Prop({ required: true, unique: true })
  topic: string;

  @Prop({ required: true })
  imageUrl: string;
}

export const TopicImageSchema = SchemaFactory.createForClass(TopicImage); 