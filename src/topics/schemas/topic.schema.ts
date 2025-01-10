import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// 📄 주제 문서 타입 정의
export type TopicDocument = Topic & Document;

// 💡 주제 스키마 정의
@Schema({ timestamps: true })
export class Topic {
  @Prop({ required: true })
  name: string;  // 주제 이름 (예: 바나나, 사과 등)

  @Prop({ required: true })
  category: string;  // 카테고리 (예: 과일, 동물, 학용품 등)

  @Prop()
  description?: string;  // 그리기 설명 또는 팁

  @Prop()
  imageUrl?: string;  // 예시 이미지 URL

  @Prop({ default: true })
  isActive: boolean;  // 활성화 여부
}

// 🏭 Topic 클래스를 기반으로 Mongoose 스키마 생성
export const TopicSchema = SchemaFactory.createForClass(Topic); 