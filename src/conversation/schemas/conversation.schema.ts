// 📦 NestJS와 Mongoose에서 필요한 데코레이터와 타입 가져오기
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// 🔖 대화 기록 문서의 타입을 정의 - Conversation 클래스와 Document를 결합
export type ConversationDocument = Conversation & Document;

// 💬 대화 내용을 저장하기 위한 MongoDB 스키마 정의
@Schema({ timestamps: true }) // ⏰ 생성/수정 시간 자동 기록 설정
export class Conversation {
  // 🆔 사용자 세션 식별자 - 필수값
  @Prop({ required: true })
  sessionId: string;

  // 👤 노인 이름 - 필수값
  @Prop({ required: true })
  name: string;

  // 💭 사용자가 입력한 텍스트 - 필수값
  @Prop({ required: true })
  userText: string;

  // 🤖 AI가 생성한 응답 텍스트 - 필수값
  @Prop({ required: true })
  aiResponse: string;

  // 👋 첫 방문 여부 표시 - 기본값 false로 설정
  @Prop({ required: true, default: false })
  isFirstVisit: boolean;
  
  // 📅 총 출석 일수 기록 - 선택값
  @Prop()
  attendanceTotal?: string;

  // 🔥 연속 출석 일수 기록 - 선택값
  @Prop()
  attendanceStreak?: string;

  // 🔢 대화 순서를 추적하기 위한 필드
  @Prop({ required: true })
  conversationOrder: number;

  // 🎯 사용자의 관심사와 니즈 저장
  @Prop({ type: [String], default: [] })
  interests: string[];  // 관심사 (예: "꽃", "풍경", "동물")

  // 🔍 사용자가 원하는 구체적인 키워드 저장
  @Prop()
  wantedTopic?: string;
  
  @Prop({ type: Object, default: {} })
  preferences: {
    difficulty?: string;     // 선호하는 난이도 (예: "쉬움", "보통", "어려움")
    style?: string;         // 선호하는 스타일 (예: "사실적", "단순한", "추상적")
    subjects?: string[];    // 선호하는 주제들
    colors?: string[];      // 선호하는 색상들
  };

  @Prop({ type: Object, default: {} })
  personalInfo: {
    mood?: string;          // 현재 감정 상태
    physicalCondition?: string;  // 신체 상태 (예: "손떨림", "시력약함")
    experience?: string;    // 그림 그리기 경험
  };
}

// 🏭 Conversation 클래스를 기반으로 Mongoose 스키마 생성
export const ConversationSchema = SchemaFactory.createForClass(Conversation);