import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// 📄 그림 문서 타입 정의
export type DrawingDocument = Drawing & Document;

// 🎨 그림 스키마 정의
@Schema({ timestamps: true })
export class Drawing {
  @Prop({ required: true })
  sessionId: string;  // 세션 ID

  @Prop({ required: true })
  name: string;  // 사용자 이름

  @Prop({ required: true })
  topic: string;  // 그림 주제

  @Prop({ required: true })
  phase: number;  // 단계 (1: 기본 형태, 2: 구체적 묘사)

  @Prop({ required: true })
  imageUrl: string;  // S3에 저장된 이미지 URL

  @Prop()
  score?: number;  // AI 평가 점수

  @Prop()
  feedback?: string;  // AI 피드백 메시지

  @Prop()
  passed?: boolean;  // 통과 여부
}

// 🏭 Drawing 클래스를 기반으로 Mongoose 스키마 생성
export const DrawingSchema = SchemaFactory.createForClass(Drawing); 