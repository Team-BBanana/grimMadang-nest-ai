// 🔄 NestJS의 의존성 주입을 위한 Injectable 데코레이터 임포트
import { Injectable } from '@nestjs/common';
// 🤖 OpenAI API 사용을 위한 OpenAI 클래스 임포트
import OpenAI from 'openai';

// 💉 NestJS 의존성 주입을 위한 Injectable 데코레이터 선언
@Injectable()
export class OpenAIConfig {
  // 🔒 OpenAI 인스턴스를 private readonly로 선언하여 불변성 보장
  private readonly openai: OpenAI;

  // 🏗️ OpenAI 설정을 초기화하는 생성자
  constructor() {
    // ⚙️ 환경변수에서 API 키를 가져와 OpenAI 인스턴스 생성
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // 🔍 OpenAI 인스턴스를 반환하는 getter 메서드
  getOpenAI(): OpenAI {
    return this.openai;
  }
} 