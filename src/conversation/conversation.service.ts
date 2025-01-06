// 🔌 NestJS의 Injectable 데코레이터 임포트
import { Injectable } from '@nestjs/common';
// 🤖 OpenAI 서비스 기능을 사용하기 위한 임포트
import { OpenAIService } from '../openai/openai.service';
// 📝 대화 흐름에 필요한 DTO 타입 임포트
import { WelcomeFlowRequestDto, WelcomeFlowResponseDto } from './dto/welcome-flow.dto';

// 💬 대화 관리를 위한 서비스 클래스
@Injectable()
export class ConversationService {
  // ⚡ OpenAI 서비스 주입을 위한 생성자
  constructor(private readonly openaiService: OpenAIService) {}

  // 🎉 첫 방문 시 출석 정보를 포함한 환영 메시지 처리 함수
  async processFirstWelcomeWithAttendance(
    welcomeFlowDto: WelcomeFlowRequestDto,
  ): Promise<WelcomeFlowResponseDto> {
    // ✨ 출석 데이터 유효성 검사 - 데이터가 없으면 기본 환영 처리로 전환
    if (welcomeFlowDto.attendanceTotal === 'null' || welcomeFlowDto.attendanceStreak === 'null') {
      return this.processWelcomeFlow(welcomeFlowDto);
    }

    // 📋 출석 정보를 포함한 AI 프롬프트 생성
    const prompt = `
      사용자의 출석 정보:
      - 총 출석일: ${welcomeFlowDto.attendanceTotal}일
      - 연속 출석일: ${welcomeFlowDto.attendanceStreak}일

      위 정보를 바탕으로 노인 사용자에게 친근하고 따뜻한 환영 인사를 해주세요.
      출석 기록에 대해 칭찬하고, 오늘도 함께 즐거운 시간을 보내자고 격려해주세요.
    `;

    // 🤖 AI 텍스트 응답 생성
    const aiResponse = await this.openaiService.generateText(prompt);
    // 🔊 텍스트를 음성으로 변환
    const aiResponseWav = await this.openaiService.textToSpeech(aiResponse);

    // 📦 응답 객체 반환
    return {
      aiResponseWelcomeWav: aiResponseWav,
      choice: false,
    };
  }

  // 🌟 일반적인 환영 메시지 처리 함수
  async processWelcomeFlow(
    welcomeFlowDto: WelcomeFlowRequestDto,
  ): Promise<WelcomeFlowResponseDto> {
    // 👋 첫 방문자 처리
    if (welcomeFlowDto.userRequestWavWelcome === 'first') {
      // 💭 첫 방문자용 프롬프트 생성
      const prompt = '처음 방문한 노인 사용자에게 친근하고 따뜻한 환영 인사를 해주세요.';
      // 🤖 AI 응답 생성
      const aiResponse = await this.openaiService.generateText(prompt);
      // 🔊 텍스트를 음성으로 변환
      const aiResponseWav = await this.openaiService.textToSpeech(aiResponse);

      // 📦 응답 객체 반환
      return {
        aiResponseWelcomeWav: aiResponseWav,
        choice: false,
      };
    }

    // 🎤 사용자의 음성을 텍스트로 변환
    const userText = await this.openaiService.speechToText(
      Buffer.from(welcomeFlowDto.userRequestWavWelcome, 'base64'),
    );

    // 📝 사용자 대화에 대한 AI 프롬프트 생성
    const prompt = `
      사용자: ${userText}

      위 대화에 대해 노인 사용자와 자연스럽게 대화를 이어가주세요.
      만약 사용자가 그림 그리기에 관심을 보이면 choice를 true로 설정하세요.
    `;

    // 🤖 AI 텍스트 응답 생성
    const aiResponse = await this.openaiService.generateText(prompt);
    // 🔊 텍스트를 음성으로 변환
    const aiResponseWav = await this.openaiService.textToSpeech(aiResponse);

    // 🎨 그림 그리기 관련 키워드 확인
    const wantsToDraw = aiResponse.toLowerCase().includes('그림') || 
                       userText.toLowerCase().includes('그림');

    // 📦 최종 응답 객체 반환
    return {
      aiResponseWelcomeWav: aiResponseWav,
      choice: wantsToDraw,
    };
  }
}
