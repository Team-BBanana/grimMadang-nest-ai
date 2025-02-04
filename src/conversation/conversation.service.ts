// 🔧 필요한 모듈들을 가져옴
import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';
import { WelcomeFlowRequestDto, WelcomeFlowResponseDto } from './dto/welcome-flow.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { isBuffer } from 'util';
import { TopicImage } from '../topics/schemas/topic-image.schema';

// 💉 Injectable 데코레이터로 서비스 클래스 정의
@Injectable()
export class ConversationService {
  // 📝 로거 인스턴스 생성
  private readonly logger = new Logger(ConversationService.name);

  // 🏗️ 생성자: OpenAI 서비스와 MongoDB 모델 주입
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
    @InjectModel(TopicImage.name)
    private topicImageModel: Model<TopicImage>,
    private readonly openaiService: OpenAIService,
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
        
        // wantedTopic이 있는 경우 로그 추가
        if (userInfo['wantedTopic']) {
          this.logger.debug('Found wantedTopic:', userInfo['wantedTopic']);
        }
      } catch (error) {
        this.logger.error('Error parsing user info:', error);
      }
    }
    return userInfo;
  }

  // 🎯 AI 응답에서 실제 텍스트만 추출하는 함수
  private extractCleanText(aiResponse: string): string {
    this.logger.debug('Original response before cleaning:', aiResponse);

    // 1. 모든 [TAG:내용] 형식의 태그를 제거
    let cleanText = aiResponse
      // TOPIC_RECOMMEND 태그 제거 (대소문자 무관)
      .replace(/\[TOPIC_RECOMMEND\](.*?)\[\/TOPIC_RECOMMEND\]/gis, '')
      // INFO 태그 제거 (JSON 포함)
      .replace(/\[INFO\s*:\s*{.*?}\]/gis, '')
      // DRAW 태그 제거
      .replace(/\[DRAW\s*:\s*(true|false)\]/gis, '')
      // 기타 남은 태그 제거
      .replace(/\[[A-Z_]+:.*?\]/gis, '')
      // 연속된 공백 제거
      .replace(/\s+/g, ' ')
      .trim();

    this.logger.debug('Response after tag removal:', cleanText);

    // 2. 따옴표로 둘러싸인 경우 제거
    cleanText = cleanText.replace(/^["'](.*)["']$/s, '$1').trim();
    
    // 3. 빈 응답 체크
    if (!cleanText) {
      this.logger.warn('Clean text is empty after processing');
      return '안녕하세요.';
    }

    this.logger.debug('Final cleaned response:', cleanText);
    return cleanText;
  }

  // 🎨 AI 응답에서 그리기 의도를 추출하는 함수
  private extractDrawIntent(aiResponse: string): boolean {
    const drawMatch = aiResponse.match(/\[DRAW:(true|false)\]/);
    return drawMatch ? drawMatch[1] === 'true' : false;
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

      // 🎨 DB에서 사용 가능한 토픽 목록 조회 및 랜덤 셔플
      const availableTopics = await this.topicImageModel.find().distinct('topic');
      const shuffledTopics = availableTopics.sort(() => Math.random() - 0.5);
      this.logger.debug('Available topics:', shuffledTopics);

      // 📝 시스템 프롬프트 생성
      const systemPrompt = `
        당신은 노인 사용자를 위한 AI 어시스턴트입니다.

        응답 형식 규칙:
        1. 자연스럽게 이름을 포함하여 대화하세요.
        2. 총 발화는 20단어 이내로 해주세요.
        3. 절대로 이모지나 이모티콘을 포함하지 마세요:
           - 유니코드 이모지 사용 금지 (예: 😊 🎨 등)
           - ASCII 이모티콘 사용 금지 (예: :) ㅎㅎ ^^ 등)
           - 특수문자를 이용한 이모티콘 사용 금지 (예: ♥ ★ ▶ 등)
        4. 오직 다음 문자만 사용하세요:
           - 한글
           - 기본 문장부호 (마침표, 쉼표, 물음표, 느낌표)
           - 기본 괄호

        응답 구조:
        1. 환영 인사
        2. [TOPIC_RECOMMEND] 태그 안에 추천 토픽 3개를 JSON 배열로 포함
           예시: [TOPIC_RECOMMEND]["사과", "바나나", "포도"][/TOPIC_RECOMMEND]

        주의사항:
        1. 추천하는 토픽은 반드시 제공된 availableTopics 목록에서만 선택하세요.
        2. 토픽은 정확히 3개를 추천해야 합니다.
        3. 응답에는 반드시 환영 인사와 토픽 추천이 모두 포함되어야 합니다.
        4. 매번 다른 토픽을 추천하도록 노력하세요.
        5. 제공된 토픽 목록의 앞쪽에 있는 것을 우선적으로 선택하세요.
      `;

      // 📝 유저 프롬프트 생성
      const userPrompt = `
        ${previousConversations ? '\n이전 대화 내역:\n\n' + `${previousConversations}` + '\n\n' : ''}
        
        사용자 정보:
        - 이름: ${welcomeFlowDto.name}
        
        사용 가능한 토픽 목록 (앞쪽에 있는 토픽을 우선적으로 선택해주세요):
        ${JSON.stringify(shuffledTopics)}

        위 정보를 바탕으로 ${welcomeFlowDto.name}님께 환영 인사를 하고, 그림 그리기에 적합한 토픽 3개를 추천해주세요.
        토픽 추천은 반드시 제공된 availableTopics 목록에서만 선택해주세요.
        가능한 목록의 앞쪽에 있는 토픽을 선택해주세요.
      `;
  
      this.logger.debug('Generated system prompt:', systemPrompt);
      this.logger.debug('Generated user prompt:', userPrompt);

      // 🤖 AI 응답 생성 및 처리
      try {
        const aiResponse = await this.openaiService.generateText(systemPrompt, userPrompt);
        this.logger.debug('Original AI Response:', aiResponse);

        // 토픽 추천 추출
        const topicMatch = aiResponse.match(/\[TOPIC_RECOMMEND\](.*?)\[\/TOPIC_RECOMMEND\]/is);
        let recommendedTopics: string[] = [];
        
        if (topicMatch && topicMatch[1]) {
          try {
            recommendedTopics = JSON.parse(topicMatch[1]);
            this.logger.debug('Extracted topics:', recommendedTopics);
            
            // 토픽 유효성 검사
            if (!Array.isArray(recommendedTopics) || recommendedTopics.length !== 3) {
              this.logger.warn('Invalid topics format or count:', recommendedTopics);
              recommendedTopics = shuffledTopics.slice(0, 3); // 첫 3개 토픽 사용
            }
          } catch (error) {
            this.logger.error('Failed to parse recommended topics:', error);
            recommendedTopics = shuffledTopics.slice(0, 3); // 파싱 실패 시 첫 3개 토픽 사용
          }
        } else {
          this.logger.warn('No topic recommendations found in response');
          recommendedTopics = shuffledTopics.slice(0, 3); // 토픽 태그 없을 시 첫 3개 토픽 사용
        }

        // 태그 제거 및 응답 정리
        const cleanResponse = this.extractCleanText(aiResponse);
        this.logger.debug('Clean response:', cleanResponse);

        // 환영 인사와 토픽 추천을 자연스럽게 통합
        const combinedResponse = `${cleanResponse} ${recommendedTopics.join(', ')} 중에서 어떤 것을 그려보고 싶으신가요?`;
        this.logger.debug('Combined response:', combinedResponse);

        // TODO: TTS 임시 비활성화 (비용 절감)
        const aiResponseWav = Buffer.from('');
        this.logger.debug('Generated empty buffer for audio response');

        // 💾 대화 내용 저장
        await this.saveConversation(
          welcomeFlowDto.sessionId,
          welcomeFlowDto.name,
          'first',
          combinedResponse,  // 통합된 응답 저장
          true,
          welcomeFlowDto.attendanceTotal,
          welcomeFlowDto.attendanceStreak,
          recommendedTopics,
          undefined,
          undefined,
          undefined
        );

        // ✅ 결과 반환
        return {
          aiResponseWelcomeWav: combinedResponse,  // 통합된 응답 반환
          choice: false,
          recommendedTopics: recommendedTopics
        };
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
        userText = await this.openaiService.speechToText(welcomeFlowDto.userRequestWelcomeWav);
        this.logger.debug('Converted speech to text:', userText);
      } else {
        userText = welcomeFlowDto.userRequestWelcomeWav;
        this.logger.debug('Using direct text input:', userText);
      }

      // 💬 이전 대화 내역 가져오기
      const previousConversations = await this.getPreviousConversations(welcomeFlowDto.sessionId);

      // 1단계: 대화 응답 생성
      const conversationSystemPrompt = `
        당신은 노인 사용자와 대화하며 그림 그리기를 도와주는 AI 어시스턴트입니다.

        ⚠️ 응답 규칙:
        1. 반드시 한국어로만 응답
        2. 총 발화는 20단어 이내
        3. 금지 항목:
           - 이모지, 이모티콘 사용 금지
           - ASCII 이모티콘 사용 금지
           - 특수문자 이모티콘 사용 금지
        4. 허용되는 문자:
           - 한글
           - 기본 문장부호 (마침표, 쉼표, 물음표, 느낌표)
           - 기본 괄호

        5. 제한사항:
           - 그리기 어려운 주제 지양 (복잡한 동물, 상상 속 생물 등)
      `;

      const conversationUserPrompt = `
        ${previousConversations ? '이전 대화 내역:\n' + previousConversations + '\n\n' : ''}
        
        사용자 정보:
        - 이름: ${welcomeFlowDto.name}
        ${userText ? '현재 발화: ' + userText : ''}

        위 정보를 바탕으로 ${welcomeFlowDto.name}님과 자연스럽게 대화를 이어가주세요.
        이전 대화가 있다면 맥락을 고려하여 답변해주세요.
      `;

      // 대화 응답 생성
      const conversationResponse = await this.openaiService.generateText(conversationSystemPrompt, conversationUserPrompt);
      this.logger.debug('Generated conversation response:', conversationResponse);

      // 2단계: 응답 분석 및 태그 생성
      const analysisSystemPrompt = `
        당신은 대화 내용을 분석하여 정보를 추출하고 태그를 생성하는 AI 어시스턴트입니다.

        분석 규칙:
        1. 사용자 정보 파악:
           - 관심사: 사용자가 언급한 모든 주제나 관심사를 배열로 기록
           - 그리고 싶은 주제: 사용자가 직접적으로 그리고 싶다고 언급한 구체적인 주제
           - 선호도: 난이도, 스타일 등 사용자가 언급한 선호사항
           - 개인정보: 현재 상태, 감정 등

        2. 태그 생성 규칙:
           [INFO] 태그:
           - interests: 언급된 모든 관심사를 배열로 포함
           - wantedTopic: 그리고 싶다고 명확한 의향 표현이 있는 경우
             * "~그리고 싶어", "~그려보고 싶어" 등 직접적인 의향 표현이 있어야 함
             * 해당 표현이 없으면 빈 문자열로 설정
           - preferences: 선호도 정보
           - personalInfo: 개인 상태 정보

           [DRAW] 태그:
           - true로 설정해야 하는 경우:
             * "~그리고 싶어", "~그려보고 싶어" 등 명확한 의향 표현이 있는 경우
             * 특정 주제를 지정하여 그리기를 원하는 경우
           - false로 설정하는 경우:
             * 단순히 그리기에 대한 관심만 표현한 경우
             * 그리기 의향이 불명확한 경우 

        응답 형식:
        반드시 아래 형식으로만 응답하세요:
        [INFO:{"interests":["관심사1","관심사2"],"wantedTopic":"그리고 싶다고 명시한 주제","preferences":{},"personalInfo":{}}]
        [DRAW:true/false]

        예시:
        입력: "사과 그리고 싶어"
        출력:
        [INFO:{"interests":["과일","사과"],"wantedTopic":"사과","preferences":{},"personalInfo":{}}]
        [DRAW:true]
      `;

      const analysisUserPrompt = `
        사용자 발화: ${userText}
        AI 응답: ${conversationResponse}

        위 대화를 분석하여 정보를 추출하고 태그를 생성해주세요.
        특히 다음 사항을 중점적으로 파악해주세요:
        1. 사용자가 특정 주제를 그리고 싶어하는지
        2. 사용자의 관심사나 선호도
        3. 사용자의 현재 상태나 감정
      `;

      // 태그 생성
      const tagResponse = await this.openaiService.generateAnalysis(analysisSystemPrompt, analysisUserPrompt);
      this.logger.debug('Generated tags:', tagResponse);

      // 최종 응답 조합
      const aiResponse = `${conversationResponse}\n${tagResponse}`;
      this.logger.debug('Combined response:', aiResponse);

      // 응답 처리 로직
      const userInfo = this.extractUserInfo(aiResponse);
      const wantsToDraw = this.extractDrawIntent(aiResponse);
      const cleanResponse = this.extractCleanText(conversationResponse);  // 순수 대화 응답만 사용

      this.logger.debug('Clean Response:', cleanResponse);

      if (!cleanResponse) {
        this.logger.warn('Clean response is empty, using default response');
        const defaultResponse = '무엇을 도와드릴까요?';
        
        // 💾 대화 내용 저장 (기본 응답)
        await this.saveConversation(
          welcomeFlowDto.sessionId,
          welcomeFlowDto.name,
          userText,
          defaultResponse,
          false,
          undefined,
          undefined,
          userInfo.interests || [],
          userInfo.wantedTopic || null,
          userInfo.preferences || {},
          userInfo.personalInfo || {}
        );

        return {
          aiResponseWelcomeWav: defaultResponse,
          choice: wantsToDraw,
          wantedTopic: userInfo.wantedTopic || null
        };
      }

      // TODO: TTS 임시 비활성화 (비용 절감)
      // const aiResponseWav = await this.openaiService.textToSpeech(cleanResponse);
      const aiResponseWav = Buffer.from(''); // 빈 버퍼 반환
      this.logger.debug('Generated audio response');

      // 💾 대화 내용 저장 (추출된 정보 포함)
      await this.saveConversation(
        welcomeFlowDto.sessionId,
        welcomeFlowDto.name,
        userText,
        cleanResponse,
        wantsToDraw,  // choice 값을 정확하게 저장
        undefined,
        undefined,
        userInfo.interests || [],           // 빈 배열 기본값 설정
        userInfo.wantedTopic || null,       // null 기본값 설정
        userInfo.preferences || {},         // 빈 객체 기본값 설정
        userInfo.personalInfo || {}         // 빈 객체 기본값 설정
      );

      // 디버그 로그 추가
      this.logger.debug('User Info:', userInfo);
      this.logger.debug('Wants to draw:', wantsToDraw);
      this.logger.debug('Wanted Topic:', userInfo.wantedTopic);

      // ✅ 결과 반환 (wantedTopic이 있으면 choice도 true여야 함)
      const hasWantedTopic = !!userInfo.wantedTopic;
      return {
        aiResponseWelcomeWav: cleanResponse,
        choice: hasWantedTopic || wantsToDraw,  // wantedTopic이 있으면 무조건 true
        wantedTopic: userInfo.wantedTopic || null
      };
    } catch (error) {
      // ❌ 에러 처리
      this.logger.error(`Error in processWelcomeFlow: ${error.message}`, error.stack);
      throw error;
    }
  }



}