// 🔧 필요한 모듈들을 가져옴
import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';
import { WelcomeFlowRequestDto, WelcomeFlowResponseDto } from './dto/welcome-flow.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { isBuffer } from 'util';

// 💉 Injectable 데코레이터로 서비스 클래스 정의
@Injectable()
export class ConversationService {
  // 📝 로거 인스턴스 생성
  private readonly logger = new Logger(ConversationService.name);

  // 🏗️ 생성자: OpenAI 서비스와 MongoDB 모델 주입
  constructor(

    private readonly openaiService: OpenAIService,

    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,

  ) { }

  // 💬 AI 응답에서 사용자 정보를 추출하는 함수
  private extractUserInfo(aiResponse: string): { 
    interests?: string[], 
    wantedTopic?: string, 
    preferences?: { 
      difficulty?: string; 
      style?: string; 
      subjects?: string[]; 
      colors?: string[]; 
    }, 
    personalInfo?: { 
      mood?: string; 
      physicalCondition?: string; 
      experience?: string; 
    } 
  } {
    const infoMatch = aiResponse.match(/\[INFO:({.*?})\]/);
    let userInfo = {};
    if (infoMatch) {
      try {
        userInfo = JSON.parse(infoMatch[1]);
        this.logger.debug('Extracted user info:', userInfo);
      } catch (error) {
        this.logger.error('Error parsing user info:', error);
      }
    }
    return userInfo;
  }

  // 💬 이전 대화 내역을 가져오는 private 메소드
  private async getPreviousConversations(sessionId: string): Promise<string> {
    // 🔍 디버그 로그 출력
    this.logger.debug(`Fetching previous conversations for session: ${sessionId}`);

    // 📚 최근 5개의 대화 내역을 가져옴
    const conversations = await this.conversationModel
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(5)
      .exec();

    // ❌ 대화 내역이 없는 경우 빈 문자열 반환
    if (conversations.length === 0) {
      this.logger.debug('No previous conversations found');
      return '';
    }

    // ✨ 대화 내역을 포맷팅하여 반환
    this.logger.debug(`Found ${conversations.length} previous conversations`);
    return conversations
      .reverse()
      .map(conv => `사용자: ${conv.userText}\n AI: ${conv.aiResponse}`)
      .join('\n\n');
  }


    // 💾 대화 내용을 저장하는 private 메소드
    private async saveConversation(
      sessionId: string, // 세션 ID
      name: string, // 사용자 이름
      userText: string, // 사용자가 입력한 텍스트
      aiResponse: string, // AI의 응답 텍스트
      isFirstVisit: boolean = false, // 첫 방문 여부
      attendanceTotal?: string, // 총 출석일
      attendanceStreak?: string, // 연속 출석일
      interests?: string[], // 사용자의 관심사
      wantedTopic?: string, // 사용자가 원하는 구체적인 키워드
      preferences?: { // 사용자의 선호도
        difficulty?: string; // 난이도
        style?: string; // 스타일
        subjects?: string[]; // 주제
        colors?: string[]; // 색상
      },
      personalInfo?: { // 사용자의 개인정보
        mood?: string; // 현재 기분
        physicalCondition?: string; // 신체 상태
        experience?: string; // 그림 그리기 경험
      },
    ): Promise<void> { 
      this.logger.debug(`Saving conversation for session: ${sessionId}, name: ${name}`);
  
      // 🔢 대화 순서 번호 계산
      const lastConversation = await this.conversationModel
        .findOne({ sessionId })
        .sort({ conversationOrder: -1 })
        .exec();
  
      const conversationOrder = lastConversation ? lastConversation.conversationOrder + 1 : 1;
      this.logger.debug(`Conversation order: ${conversationOrder}`);
  
  
      // 💾 대화 내용 저장 시도
      try {
        await this.conversationModel.create({
          sessionId,
          name,
          userText,
          aiResponse,
          isFirstVisit,
          attendanceTotal,
          attendanceStreak,
          conversationOrder,
          interests,
          wantedTopic,
          preferences,
          personalInfo,
        });
        this.logger.debug('Conversation saved successfully');
      } catch (error) {
        // ❌ 에러 발생 시 로깅 및 에러 전파
        this.logger.error(`Error saving conversation: ${error.message}`);
        throw error;
      }
    }
  
  
    // 👋 첫 방문자 환영 메시지 처리 메소드
    // 메인 메소드1 
    async processFirstWelcomeWithAttendance(welcomeFlowDto: WelcomeFlowRequestDto): Promise<WelcomeFlowResponseDto> {
      // 📝 로그 출력
      this.logger.log(`Processing first welcome with attendance for session: ${welcomeFlowDto.sessionId}`);
  
      // 📊 출석 데이터 존재 여부 확인
      const hasAttendanceData = welcomeFlowDto.attendanceTotal !== 'null' || welcomeFlowDto.attendanceStreak !== 'null';
  
      this.logger.debug(`Has attendance data: ${hasAttendanceData}`);
  
      // 💬 이전 대화 내역 가져오기
      const previousConversations = await this.getPreviousConversations(welcomeFlowDto.sessionId);
  
      // 📝 프롬프트 생성
      let prompt = '';

      prompt = `
        ${previousConversations ? '\n이전 대화 내역:\n\n' + `${previousConversations}` + '\n\n' : ''}
        
        사용자 정보:
        - 이름: ${welcomeFlowDto.name}
        
        ${welcomeFlowDto.name}님께 이름을 포함하며 친근하고 따뜻한 환영 인사를 해주세요.
        오늘도 함께 즐거운 시간을 보내자고 격려해주고, 이름을 자연스럽게 포함하여 대화하세요. 
        인사말을 종료하면서 자연스럽게 그림 키워드를 한두개 제안해 주세요.
        그림 키워드는 실생활에서 자주 접할 수 있거나 그리기 쉬운 것들로 해주세요:
        예시: 고양이, 의자, 사과 등

        중요: 총 발화는 50자 이내로 해주세요.
      `;

    this.logger.debug('Generated prompt:', prompt);

    // 🤖 AI 응답 생성 및 처리
    try {
      const aiResponse = await this.openaiService.generateText(prompt);
      this.logger.debug('AI Response:', aiResponse);

      // 🔊 음성 변환
      // 대신 로컬 WAV 파일 읽기 
      // const fs = require('fs');
      // const path = require('path');
      // const wavFile = path.join(process.cwd(), 'src', 'public', '1.wav');
      // const aiResponseWav = fs.readFileSync(wavFile);
      // this.logger.debug('Loaded local WAV file for response');

      // const aiResponseWav = await this.openaiService.textToSpeech(aiResponse);
        
      // TODO: TTS 임시 비활성화 (비용 절감)
      const aiResponseWav = Buffer.from(''); // 빈 버퍼 반환
      this.logger.debug('Generated empty buffer for audio response');


      // 💾 대화 내용 저장
      await this.saveConversation(
        welcomeFlowDto.sessionId,
        welcomeFlowDto.name,
        'first',
        aiResponse,
        true,
        welcomeFlowDto.attendanceTotal,
        welcomeFlowDto.attendanceStreak,
        undefined, // interests 초기화
        undefined, // wantedTopic 초기화
        undefined, // preferences 초기화
        undefined  // personalInfo 초기화
      );

      // ✅ 결과 반환
      return {
        aiResponseWelcomeWav: aiResponseWav, // 이미 압축된 base64 문자열
        choice: false,
      };
    } catch (error) {
      // ❌ 에러 처리
      this.logger.error(`Error in processFirstWelcomeWithAttendance: ${error.message}`, error.stack);
      throw error;(''); // 빈 버퍼 반환
      // this.logger.debug('Generated empt
    }
  }

  // 사용자 발화 분석 함수 추가
  private analyzeUserInput(userText: string): { 
    wantedTopic: string,
    isPositive: boolean 
  } {
    // "다른거"를 제외한 실제 주제만 매칭하도록 수정
    const wantToDrawMatch = userText.match(/(?:(?!다른).)*?\s*그리고\s*싶어/);
    let wantedTopic = '';
    let isPositive = false;

    if (wantToDrawMatch && !userText.includes('다른')) {
      // "그리고 싶어" 앞의 실제 주제만 추출
      wantedTopic = wantToDrawMatch[0]
        .replace(/\s*그리고\s*싶어$/, '')  // "그리고 싶어" 제거
        .trim();
      isPositive = true;
    }

    // "다른거"가 포함된 경우는 무조건 부정적으로 처리
    if (userText.includes('다른')) {
      isPositive = false;
      wantedTopic = '';
    }

    return {
      wantedTopic,
      isPositive
    };
  }

  // 이전 대화에서 제안된 주제들을 추출하는 함수 추가
  private extractPreviousTopics(conversations: string): string[] {
    const topics = new Set<string>();
    const matches = conversations.matchAll(/그려보는 건 어떨까요\? ([^을를\s]+)[을를]/g);
    for (const match of matches) {
      topics.add(match[1]);
    }
    return Array.from(topics);
  }

  // 🌟 일반 대화 처리 메소드
  // 메인 메소드2
  async processWelcomeFlow(
    welcomeFlowDto: WelcomeFlowRequestDto,
  ): Promise<WelcomeFlowResponseDto> {
    // 📝 로그 출력
    this.logger.log(`Processing welcome flow for session: ${welcomeFlowDto.sessionId}`);

    // 👋 첫 방문자 처리
    if (welcomeFlowDto.userRequestWelcomeWav === 'first') {
      this.logger.debug('Processing first visit');
      return this.processFirstWelcomeWithAttendance(welcomeFlowDto);
    }

    try {
      let userText: string;

      // 🎤 음성 데이터 처리
      if (Buffer.isBuffer(welcomeFlowDto.userRequestWelcomeWav)) {
        userText = await this.openaiService.speechToText(welcomeFlowDto.userRequestWelcomeWav);
        this.logger.debug('Converted speech to text:', userText);
      } else {
        userText = welcomeFlowDto.userRequestWelcomeWav;
        this.logger.debug('Using direct text input:', userText);
      }

      // 💬 이전 대화 내역 가져오기
      const previousConversations = await this.getPreviousConversations(welcomeFlowDto.sessionId);
      const previousTopics = this.extractPreviousTopics(previousConversations);
      const userInput = this.analyzeUserInput(userText);

      const prompt = `
        ${previousConversations ? '이전 대화 내역:\n' + previousConversations + '\n\n' : ''}
        사용자 정보:
        - 이름: ${welcomeFlowDto.name}
        - 현재 사용자 발화: ${userText}

        ⚠️ 절대 규칙:
        1. 총 발화는 30자 이내로 해주세요
        2. 반드시 한국어로만 응답해주세요
        3. 이모지는 사용하지 마세요
        4. 사용자가 키워드에 긍정적인 응답을 한 경우에 다른 주제를 언급하지 마세요
        5. 사용자가 키워드에 부정적인 응답을 한 경우, 이전에 제안했던 주제(${previousTopics.join(', ')})는 다시 제안하지 마세요

        답변 형식:
        ${userInput.isPositive 
          ? `"${userInput.wantedTopic}를 좋아하시는군요, 좋습니다! 함께 ${userInput.wantedTopic}를 그려보아요!"` 
          : '"다른 그림을 그려보고 싶으신가요? [새로운 주제]를 그려보는 건 어떨까요?"'}

        <시스템 태그>
        [INFO:{"wantedTopic":"${userInput.wantedTopic}"}]
        [DRAW:${userInput.isPositive}]
        </시스템 태그>
      `;

      this.logger.debug('Generated prompt:', prompt);

      // 🤖 AI 응답 생성
      const aiResponse = await this.openaiService.generateText(prompt);
      this.logger.debug('AI Response:', aiResponse);

      // 🔊 사용자 정보 추출 (원본 응답에서)
      const userInfo = this.extractUserInfo(aiResponse);
      const wantsToDraw = /\[DRAW:true\]/.test(aiResponse);

      this.logger.debug(`Wants to draw: ${wantsToDraw}`);

      // 수정: 이모지와 태그만 제거하고 실제 텍스트는 유지
      const cleanResponse = aiResponse
        .replace(/\[INFO:.*?\]/g, '')  // INFO 태그 제거
        .replace(/\[DRAW:.*?\]/g, '')  // DRAW 태그 제거
        .replace(/[^\p{L}\p{N}\p{P}\s]/gu, '') // 이모지 제거
        .trim();

      this.logger.debug('Clean Response:', cleanResponse);

      // TTS 실행 전 빈 문자열 체크
      if (!cleanResponse) {
        throw new Error('Clean response is empty');
      }
      // TODO: TTS 임시 비활성화 (비용 절감)
      // const aiResponseWav = await this.openaiService.textToSpeech(cleanResponse);
      const aiResponseWav = Buffer.from(''); // 빈 버퍼 반환
      // this.logger.debug('Generated audio response');

      // 💾 대화 내용 저장 (추출된 정보 포함)
      await this.saveConversation(
        welcomeFlowDto.sessionId,
        welcomeFlowDto.name,
        userText,
        cleanResponse,
        false,
        undefined,
        undefined,
        userInfo.interests,
        userInfo.wantedTopic,
        userInfo.preferences,
        userInfo.personalInfo,
      );

      // ✅ 결과 반환
      return {
        aiResponseWelcomeWav: aiResponseWav,
        choice: wantsToDraw,
        wantedTopic: userInfo.wantedTopic
      };
    } catch (error) {
      // ❌ 에러 처리
      this.logger.error(`Error in processWelcomeFlow: ${error.message}`, error.stack);
      throw error;
    }
  }



}