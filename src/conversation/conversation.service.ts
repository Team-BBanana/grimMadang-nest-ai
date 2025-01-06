// 🎯 NestJS의 Injectable 데코레이터 임포트
import { Injectable } from '@nestjs/common';
// 🤖 OpenAI 서비스 기능 임포트
import { OpenAIService } from '../openai/openai.service';
// 📝 웰컴 플로우 관련 DTO 타입 임포트
import { WelcomeFlowRequestDto, WelcomeFlowResponseDto } from './dto/welcome-flow.dto';
// 🗃️ Mongoose 모델 주입을 위한 데코레이터 임포트
import { InjectModel } from '@nestjs/mongoose';
// 📊 Mongoose 모델 타입 임포트
import { Model } from 'mongoose';
// 💬 대화 스키마 및 문서 타입 임포트
import { Conversation, ConversationDocument } from './schemas/conversation.schema';

// 🎯 대화 서비스 클래스 정의
@Injectable()
export class ConversationService {
  // 🔧 서비스 생성자: OpenAI 서비스와 대화 모델 주입
  constructor(
    private readonly openaiService: OpenAIService,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
  ) {}

  
  // 📚 이전 대화 내용을 가져오는 함수
  private async getPreviousConversations(sessionId: string): Promise<string> {
    // 🔍 최근 5개의 대화를 날짜 역순으로 조회
    const conversations = await this.conversationModel
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(5)  // 최근 5개의 대화만 가져옴
      .exec();

    // 💭 대화 내역이 없으면 빈 문자열 반환
    if (conversations.length === 0) return '';

    // 🔄 대화 내역을 시간순으로 정렬하고 문자열로 변환
    return conversations
      .reverse()
      .map(conv => `사용자: ${conv.userText}\nAI: ${conv.aiResponse}`)
      .join('\n');
  }

  // 💾 대화 내용을 데이터베이스에 저장하는 함수
  private async saveConversation(
    sessionId: string,
    userText: string,
    aiResponse: string,
    isFirstVisit: boolean = false,
    attendanceTotal?: string,
    attendanceStreak?: string,
  ): Promise<void> {
    // 📥 현재 대화 순서 조회
    const lastConversation = await this.conversationModel
      .findOne({ sessionId })
      .sort({ conversationOrder: -1 })
      .exec();

    const conversationOrder = lastConversation ? lastConversation.conversationOrder + 1 : 1;

    // 🎯 새로운 대화 내용 생성 및 저장
    await this.conversationModel.create({
      sessionId,
      userText,
      aiResponse,
      isFirstVisit,
      attendanceTotal,
      attendanceStreak,
      conversationOrder,
    });
  }

  // 👋 첫 방문 시 출석 정보를 포함한 환영 메시지 처리
  async processFirstWelcomeWithAttendance(
    welcomeFlowDto: WelcomeFlowRequestDto,
  ): Promise<WelcomeFlowResponseDto> {
    // ✅ 출석 데이터 존재 여부 확인
    const hasAttendanceData = 
      welcomeFlowDto.attendanceTotal !== 'null' || 
      welcomeFlowDto.attendanceStreak !== 'null';

    // 📜 이전 대화 내용 조회
    const previousConversations = await this.getPreviousConversations(welcomeFlowDto.sessionId);

    // 📝 프롬프트 생성
    let prompt = '';
    if (hasAttendanceData) {
      // 🎉 출석 정보가 있는 경우의 프롬프트
      prompt = `
        ${previousConversations ? '이전 대화 내역:\n' + previousConversations + '\n\n' : ''}
        사용자의 출석 정보:
        ${welcomeFlowDto.attendanceTotal !== 'null' ? `- 총 출석일: ${welcomeFlowDto.attendanceTotal}일` : ''}
        ${welcomeFlowDto.attendanceStreak !== 'null' ? `- 연속 출석일: ${welcomeFlowDto.attendanceStreak}일` : ''}

        위 정보를 바탕으로 노인 사용자에게 친근하고 따뜻한 환영 인사를 해주세요.
        출석 기록이 있다면 칭찬하고, 오늘도 함께 즐거운 시간을 보내자고 격려해주세요.
      `;
    } else {
      // 🌟 첫 방문자를 위한 기본 프롬프트
      prompt = '처음 방문한 노인 사용자에게 친근하고 따뜻한 환영 인사를 해주세요.';
    }

    // 🤖 AI 응답 생성 및 음성 변환
    const aiResponse = await this.openaiService.generateText(prompt);
    const aiResponseWav = await this.openaiService.textToSpeech(aiResponse);

    // 💾 대화 내용 저장
    await this.saveConversation(
      welcomeFlowDto.sessionId,
      'first',
      aiResponse,
      true,
      welcomeFlowDto.attendanceTotal,
      welcomeFlowDto.attendanceStreak,
    );

    // 📤 응답 반환
    return {
      aiResponseWelcomeWav: aiResponseWav,
      choice: false,
    };
  }

  // 🎭 웰컴 플로우 메인 처리 함수
  async processWelcomeFlow(
    welcomeFlowDto: WelcomeFlowRequestDto,
  ): Promise<WelcomeFlowResponseDto> {
    // 👋 첫 방문자 처리
    if (welcomeFlowDto.userRequestWavWelcome === 'first') {
      return this.processFirstWelcomeWithAttendance(welcomeFlowDto);
    }

    // 🎤 음성을 텍스트로 변환
    const userText = await this.openaiService.speechToText(
      Buffer.from(welcomeFlowDto.userRequestWavWelcome, 'base64'),
    );

    // 📚 이전 대화 내용 조회
    const previousConversations = await this.getPreviousConversations(welcomeFlowDto.sessionId);

    // 📝 프롬프트 생성
    const prompt = `
      ${previousConversations ? '이전 대화 내역:\n' + previousConversations + '\n\n' : ''}
      현재 사용자 발화: ${userText}

      위 대화 내역을 바탕으로 노인 사용자와 자연스럽게 대화를 이어가주세요.
      이전 대화 내용을 참고하여 맥락에 맞는 답변을 해주세요.
      만약 사용자가 그림 그리기에 관심을 보이면 choice를 true로 설정하세요.
    `;

    // 🤖 AI 응답 생성 및 음성 변환
    const aiResponse = await this.openaiService.generateText(prompt);
    const aiResponseWav = await this.openaiService.textToSpeech(aiResponse);

    // 🎨 그림 그리기 관심 여부 확인
    const wantsToDraw = aiResponse.toLowerCase().includes('그림') || 
                       userText.toLowerCase().includes('그림');

    // 💾 대화 내용 저장
    await this.saveConversation(
      welcomeFlowDto.sessionId,
      userText,
      aiResponse,
    );

    // 📤 응답 반환
    return {
      aiResponseWelcomeWav: aiResponseWav,
      choice: wantsToDraw,
    };
  }
}
