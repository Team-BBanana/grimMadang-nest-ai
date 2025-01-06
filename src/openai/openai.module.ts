// 📦 NestJS의 모듈 데코레이터를 가져오기
import { Module } from '@nestjs/common';
// 🤖 OpenAI 서비스 클래스 가져오기 - API 호출 관련 모든 기능 포함
import { OpenAIService } from './openai.service';
// ⚙️ OpenAI 설정 클래스 가져오기 - API 키 및 기본 설정 관리
import { OpenAIConfig } from '../config/openai.config';

// 🎯 OpenAI 기능을 모듈로 묶어서 관리
@Module({
  // 🔧 이 모듈에서 사용할 서비스와 설정 프로바이더 등록
  providers: [OpenAIService, OpenAIConfig],
  // 🚀 다른 모듈에서 사용할 수 있도록 OpenAIService 내보내기
  exports: [OpenAIService],
})

export class OpenAIModule {} 