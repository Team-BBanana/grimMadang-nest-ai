// 🔧 필요한 모듈들을 가져옴
import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';
import { GoogleSpeechService } from '../google/google-speech.service';
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
    private readonly googleSpeechService: GoogleSpeechService,
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
          중요: 이 대화의 유일한 목적은 그림 그리기입니다. 어떤 상황에서도 다른 주제로 전환하지 마세요.
          사용자 이름을 포함하여 인사말을 건네주고, 그림 주제는 실생활에서 자주 접할 수 있고 그리기 쉬운 것으로 제안해 주세요.

          사용자가 "다른 주제" 또는 "그리기 싫어"와 같은 말을 할 경우:
          1. 그림 그리기의 중요성을 강조하세요.
          2. 즉시 새롭고 매우 간단한 그림 주제를 제안하세요.
          3. 그림 그리기 외의 주제(영화, 드라마, 여행, 취미 등)는 절대 언급하지 마세요.

          답변 템플릿:
          "이번 주제가 재미없게 느껴지시나요? 이번에는 [매우 간단한 주제]를 그려보는 건 어떨까요? 아주 쉽고 재미있을 거예요. 시작해볼까요?"

          매우 간단한 그림 주제 예시:
          - 바나나, 사과 같은 과일 
          - 꽃 한 송이
          - 해와 구름

          모든 상황에서 그림 그리기로 대화를 유지하세요. 다른 주제로의 전환은 절대 허용되지 않습니다.
          주제나 키워드 제안 시 그리기 어렵거나, 상상 속의 동물처럼 이미지 생성이 어려운 것들은 지양해 주세요.

          다음 규칙을 지켜주세요:
          1. 사용자의 말에 2~3문장으로 반응해주세요 
          2. 이모지를 사용하지 마세요 
          
          예시:
          "그렇군요. 그러면 [새로운 주제]를 그려보는 건 어떠세요?"

          대화 내용에서 다음 정보들을 파악해주세요:
          1. 사용자의 관심사 (예: 꽃, 풍경, 동물 등)
          2. 사용자가 그리고 싶어하는 구체적인 키워드 (예: 바나나, 사과, 비행기 등)
          3. 선호도 (그림 난이도, 스타일, 좋아하는 주제나 색상 등)
          4. 개인정보 (현재 기분, 신체 상태, 그림 그리기 경험 등)
        
          대화에 포함된 정보를 답변 끝에 JSON 형식으로 추가해주세요, 추가하고 읽지는 마세요:
          예시: [INFO:{"interests":["꽃","나비"],"wantedTopic":"바나나","preferences":{"difficulty":"쉬움"},"personalInfo":{"mood":"즐거움"}}]

          사용자의 그림 그리기 의향을 판단해 태그를 추가하세요:
          - 사용자가 그림 그리기에 긍정적이거나 관심을 보이면 "[DRAW:true]"
          - 사용자가 그림 그리기에 부정적이거나 관심이 없으면 "[DRAW:false]"
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
      // TODO: TTS 임시 비활성화 (비용 절감)
      // const aiResponseWav = Buffer.from(''); // 빈 버퍼 반환
      // this.logger.debug('Generated empty buffer for audio response');

      // 🔊 AI 응답 생성 및 처리
      try {
        // 로컬 WAV 파일 읽기 대신 Google TTS 사용
        const aiResponseWav = await this.googleSpeechService.textToSpeech(aiResponse);

        // 대화 저장
        await this.saveConversation(
          welcomeFlowDto.sessionId,
          welcomeFlowDto.name,
          'first',
          aiResponse,
          true,
          welcomeFlowDto.attendanceTotal?.toString(),
          welcomeFlowDto.attendanceStreak?.toString(),
          undefined,
          undefined,
          undefined,
          undefined
        );

        return {
          aiResponseWelcomeWav: aiResponseWav,
          choice: false
        };
      } catch (error) {
        this.logger.error('Error in TTS or saving conversation:', error.message);
        // TTS 실패 시 빈 버퍼 반환
        return {
          aiResponseWelcomeWav: Buffer.from(''),
          choice: false
        };
      }
    } catch (error) {
      // ❌ 에러 처리
      this.logger.error(`Error in processFirstWelcomeWithAttendance: ${error.message}`, error.stack);
      throw error;
    }
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
        // userText = await this.openaiService.speechToText(welcomeFlowDto.userRequestWelcomeWav);
        userText = await this.googleSpeechService.speechToText(welcomeFlowDto.userRequestWelcomeWav);
        this.logger.debug('Converted speech to text:', userText);
      } else {
        userText = welcomeFlowDto.userRequestWelcomeWav;
        this.logger.debug('Using direct text input:', userText);
      }

      // 💬 이전 대화 내역 가져오기
      const previousConversations = await this.getPreviousConversations(welcomeFlowDto.sessionId);

      // 📝 프롬프트 생성
      const prompt = `
        ${previousConversations ? '이전 대화 내역:\n' + previousConversations + '\n\n' : ''}
        사용자 정보:
        - 이름: ${welcomeFlowDto.name} (해당 이름을 기억하여, 이름을 다시 물어보는 질문이 나오면 해당 이름을 다시 알려드리면서 대화를 이어가주세요.)
        
        현재 사용자 발화: ${userText} (해당 발화에 대한 답변이 1순위입니다. 다른 정보들은 해당 질문에 대한 답변을 자연스럽게 하기 위함입니다.)

        중요: 반드시 한국어로 응답해주세요. 영어는 절대 사용하지 마세요.
        
        위 대화 내역을 바탕으로 ${welcomeFlowDto.name}님과 자연스럽게 대화를 이어가주세요.
        이전 대화 내용을 참고하여 맥락에 맞는 답변을 해주세요.
        그리기 어려운 동물이나, 상상 속의 동물처럼 이미지 생성이 어려운 것들은 지양해 주세요.
   
        또한, 대화 내용에서 다음 정보들을 파악해주세요:
        1. 사용자의 관심사 (예: 꽃, 풍경, 동물 등)
        2. 사용자가 그리고 싶어하는 구체적인 키워드 (예: 바나나, 사과, 비행기 등)
        3. 선호도 (그림 난이도, 스타일, 좋아하는 주제나 색상 등)
        4. 개인정보 (현재 기분, 신체 상태, 그림 그리기 경험 등)
        
        파악된 정보는 답변 끝에 JSON 형식으로 추가해주세요:
        예시: [INFO:{"interests":["꽃","나비"],"wantedTopic":"바나나","preferences":{"difficulty":"쉬움"},"personalInfo":{"mood":"즐거움"}}]
        
        마지막으로, 사용자의 그림 그리기 의향도 판단해주세요:
        - 사용자가 그림 그리기에 긍정적이거나 관심을 보이면 답변 마지막에 "[DRAW:true]"를 추가해주세요.
        - 사용자가 그림 그리기에 부정적이거나 관심이 없으면 답변 마지막에 "[DRAW:false]"를 추가해주세요.
        - 답변은 자연스러워야 하며, [INFO]와 [DRAW] 태그는 맨 마지막에만 붙여주세요.
      `;

      this.logger.debug('Generated prompt:', prompt);

      // 🤖 AI 응답 생성
      const aiResponse = await this.openaiService.generateText(prompt);
      this.logger.debug('AI Response:', aiResponse);

      // 🔊 사용자 정보 추출 (원본 응답에서)
      const userInfo = this.extractUserInfo(aiResponse);
      
      const wantsToDraw = /\[DRAW:true\]$/.test(aiResponse);

      this.logger.debug(`Wants to draw: ${wantsToDraw}`);

      // 마지막 줄 제거 (JSON 태그가 있는 줄)
      const cleanResponse = aiResponse.split('\n')
        .filter(line => !line.includes('[INFO:') && !line.includes('[DRAW:'))
        .join('\n')
        .trim();
      
      this.logger.debug('Clean Response:', cleanResponse);
      
      // TODO: TTS 임시 비활성화 (비용 절감)
      // const aiResponseWav = await this.openaiService.textToSpeech(cleanResponse);
      const aiResponseWav = await this.googleSpeechService.textToSpeech(cleanResponse);
      // const aiResponseWav = Buffer.from(''); // 빈 버퍼 반환
      this.logger.debug('Generated audio response');

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
