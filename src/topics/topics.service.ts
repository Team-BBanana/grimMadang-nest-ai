// 🔧 필요한 NestJS 모듈과 서비스 임포트
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// 📝 스키마와 DTO 타입 임포트
// import { Topic, TopicDocument } from './schemas/topic.schema';
import { ExploreTopicsRequestDto, ExploreTopicsResponseDto, TopicImageDescriptionResponseDto } from './dto/explore.dto';

// 🤖 OpenAI 서비스 임포트
import { OpenAIService } from '../openai/openai.service';

// 💬 대화 스키마 임포트
import { ConversationDocument } from '../conversation/schemas/conversation.schema';

// 🌐 HTTP 요청을 위한 fetch 임포트
import fetch from 'node-fetch';

// ☁️ AWS S3 서비스 임포트
import { S3Service } from '../aws/s3.service';

// 📊 Spring API 응답 타입 정의
interface SpringMetadataResponse {
  topicName: string;    // 주제 이름
  imageUrl: string;     // 이미지 URL
  description: string;  // 주제 설명
}

// 🎯 주제 추천 서비스 클래스 정의
@Injectable()
export class TopicsService {
  // 📝 로거 초기화
  private readonly logger = new Logger('주제 추천 서비스');

  // 🗂️ 이전 추천 주제를 저장하는 맵
  private previousTopicsMap = new Map<string, string[]>();

  // 🎨 주제 그룹 저장을 위한 private 변수
  private dynamicTopicGroups: Record<string, string[]> = {};

  private readonly DEFAULT_GROUP = {
    "쉬운 그림": ["사과", "바나나", "배"]
  };

  // 🔧 서비스 생성자 - 필요한 모델과 서비스 주입
  constructor(
    // @InjectModel(Topic.name) private topicModel: Model<TopicDocument>,
    @InjectModel('Conversation') private conversationModel: Model<ConversationDocument>,
    private readonly openAIService: OpenAIService,
    private readonly s3Service: S3Service
  ) {}

  // 🎨 주제 추천 - 메인 로직
  /**
   * 사용자의 관심사와 대화 맥락을 기반으로 그림 그리기 주제를 추천하는 메인 메서드
   * @param dto - 주제 추천 요청 DTO
   * @returns 추천된 주제와 AI 응답이 포함된 응답 DTO
   */
  async exploreTopics(dto: ExploreTopicsRequestDto): Promise<ExploreTopicsResponseDto> {
    // 📝 로그 기록
    this.logger.log(`Exploring topics for user: ${dto.name} (${dto.sessionId})`);

    // 🎤 현재 세션의 마지막 대화 순서 조회
    const lastConversation = await this.conversationModel
      .findOne({ sessionId: dto.sessionId })
      .sort({ conversationOrder: -1 });

    // 🎤 음성 데이터를 텍스트로 변환 (first가 아닌 경우)
    let userText = '';
    if (dto.userRequestExploreWav !== 'first') {
      // 음성 데이터인 경우 Buffer 타입 체크
      if (Buffer.isBuffer(dto.userRequestExploreWav)) {
        userText = await this.openAIService.speechToText(dto.userRequestExploreWav);
        this.logger.debug('Converted user speech to text:', userText);
      } else {
        // 텍스트 데이터인 경우 직접 사용
        userText = dto.userRequestExploreWav;
        this.logger.debug('Using direct text input:', userText);
      }
    }

    // 📋 이전 추천 주제 가져오기
    this.logger.log('이전 추천 주제 가져오기');
    const previousTopics = this.previousTopicsMap.get(dto.sessionId) || [];

    // 👋 첫 방문 또는 새로운 세션 시작 시 처리
    if (dto.userRequestExploreWav === 'first') {
      const response = await this.handleFirstVisit(dto, previousTopics);
      
      const nextOrder = lastConversation ? lastConversation.conversationOrder + 1 : 1;
      
      await this.conversationModel.create({
        sessionId: dto.sessionId,
        name: dto.name,
        userText: '첫 방문',
        aiResponse: response.originalText,
        conversationOrder: nextOrder
      });
      return response;
    }

    // first 아닌 경우
    // 🔍 사용자의 응답 분석
    this.logger.log('사용자의 응답 분석');
    const analysis = await this.analyzeUserResponse(userText, lastConversation);
    
    // 🎯 사용자가 특정 주제를 선택한 경우 (확정은 아직)
    if (analysis.selectedTopic && !analysis.confirmedTopic) {
      const response = await this.handleTopicSelection(analysis.selectedTopic, dto.name, dto.isTimedOut);
      
      const nextOrder = lastConversation ? lastConversation.conversationOrder + 1 : 1;
      
      await this.conversationModel.create({
        sessionId: dto.sessionId,
        name: dto.name,
        userText: userText,
        aiResponse: response.originalText,
        conversationOrder: nextOrder
      });
      return response;
    }

    this.logger.log("토픽 select 있잖아? : " + analysis.selectedTopic);

    // ✅ 사용자가 주제를 확정한 경우
    if (analysis.confirmedTopic) {
      this.logger.debug('주제 확정 처리 시작', {
        selectedTopic: analysis.selectedTopic,
        previousTopics
      });
      
      const topicToConfirm = analysis.selectedTopic || previousTopics[0];
      if (!topicToConfirm) {
        this.logger.error('확정할 주제를 찾을 수 없습니다');
        throw new Error('확정할 주제를 찾을 수 없습니다');
      }

      const response = await this.handleTopicConfirmation(topicToConfirm, dto.name);
      
      const nextOrder = lastConversation ? lastConversation.conversationOrder + 1 : 1;
      
      await this.conversationModel.create({
        sessionId: dto.sessionId,
        name: dto.name,
        userText: userText,
        aiResponse: response.originalText || `${topicToConfirm}로 시작해볼까요?`,
        conversationOrder: nextOrder
      });
      return response;
    }

    // 🔄 사용자가 다른 주제 그룹을 원하는 경우
    if (analysis.wantsDifferentGroup) {
      const response = await this.handleDifferentGroupRequest(dto, previousTopics);
      
      const nextOrder = lastConversation ? lastConversation.conversationOrder + 1 : 1;
      
      await this.conversationModel.create({
        sessionId: dto.sessionId,
        name: dto.name,
        userText: userText,
        aiResponse: response.originalText || '다른 주제 그룹을 보여드릴게요.',
        conversationOrder: nextOrder
      });
      return response;
    }

    // 🎨 현재 그룹에서 다른 주제를 원하는 경우 (기본 케이스)
    const response = await this.handleSameGroupDifferentTopics(dto, previousTopics);
    
    const nextOrder = lastConversation ? lastConversation.conversationOrder + 1 : 1;
    
    await this.conversationModel.create({
        sessionId: dto.sessionId,
        name: dto.name,
        userText: userText,
        aiResponse: response.originalText || '다른 주제를 보여드릴게요.',
        conversationOrder: nextOrder
    });
    return response;
  }

  // 🎯 주요 핸들러 함수들
  /**
   * 👋 첫 방문 시 주제 추천 처리
   */
  private async handleFirstVisit(
    dto: ExploreTopicsRequestDto,
    previousTopics: string[]
  ): Promise<ExploreTopicsResponseDto> {
    // 📝 사용자의 관심사 분석
    const interests = await this.analyzeInterests(dto.sessionId);
    this.logger.debug('분석된 관심사:', interests);

    // 🎲 주제 그룹 생성
    this.dynamicTopicGroups = await this.generateTopicGroups(interests);
    this.logger.debug('생성된 주제 그룹들:', this.dynamicTopicGroups);

    // 🎯 주제 그룹 선택
    const selectedGroup = await this.selectTopicGroupWithAI(interests);
    this.logger.debug('선택된 그룹:', selectedGroup);
    
    // 선택된 그룹의 주제들 가져오기
    const selectedTopics = this.dynamicTopicGroups[selectedGroup] || this.generateFallbackTopics();
    this.logger.debug('선택된 주제들:', {
      group: selectedGroup,
      topics: selectedTopics,
      isDefault: !this.dynamicTopicGroups[selectedGroup]
    });
    
    // 📝 이전 추천 주제 저장
    this.logger.log(`이전 추천 주제 저장:`, {
      sessionId: dto.sessionId,
      topics: selectedTopics
    });
    this.previousTopicsMap.set(dto.sessionId, selectedTopics);
    
    // 🎤 선택된 주제를 음성 메시지로 변환
    const aiText = `${dto.name}님, 오늘은 ${selectedTopics.join(', ')} 중에서 그리고 싶은 주제를 선택해주세요.`;
    this.logger.log(aiText);

    // TODO: 실 테스트용 AI 음성 버퍼 반환
    const audioBuffer = await this.openAIService.textToSpeech(aiText);

    // TODO: TTS 임시 비활성화 (비용 절감)
    // const audioBuffer = Buffer.from(''); // 빈 버퍼 반환

    // 📝 응답 반환
    return {
      topics: selectedTopics,
      select: 'false',
      aiResponseExploreWav: audioBuffer,
      originalText: aiText
    };
  }

  /**
   * 🎯 주제 선택 처리
   */
  private async handleTopicSelection(
    selectedTopic: string,
    name: string,
    isTimedOut: string
  ): Promise<ExploreTopicsResponseDto> {
    const metadata = await this.handleTopicMetadata(selectedTopic);
    const aiResponse = `${selectedTopic}가 맞나요?`;
    // TODO: 실제 테스트용 AI 음성 버퍼 반환
    const audioBuffer = await this.openAIService.textToSpeech(aiResponse);

    // TODO: TTS 임시 비활성화 (비용 절감)
    // const audioBuffer = Buffer.from(''); // 빈 버퍼 반환

    return {
      topics: selectedTopic,
      select: 'false',
      aiResponseExploreWav: audioBuffer,
      metadata: metadata || undefined,
      originalText: aiResponse
    };
  }

  /**
   * ✅ 주제 확정 처리
   */
  private async handleTopicConfirmation(
    selectedTopic: string,
    name: string
  ): Promise<ExploreTopicsResponseDto> {
    this.logger.debug('주제 확정 처리 시작:', { selectedTopic, name });
    
    if (!selectedTopic) {
      this.logger.error('선택된 주제가 없습니다');
      throw new Error('선택된 주제가 없습니다');
    }

    const confirmationPrompt = `
      주제: ${selectedTopic}
      상황: 노인 사용자가 해당 주제로 그림을 그리기로 확정했습니다.
      요구사항: 
      1. 그림을 그리기 시작하자는 긍정적이고 따뜻한 메시지를 생성해주세요.
      2. 해당 주제의 핵심적인 그리기 포인트를 간단히 언급해주세요.
      3. 자연스러운 대화체로 작성해주세요.
      예시: "좋아요, 바나나는 곡선을 살리는 게 포인트예요. 한번 시작해볼까요?"
    `;
    
    const aiResponse = await this.openAIService.generateText(confirmationPrompt);
    this.logger.debug('AI 응답 생성 완료:', aiResponse);

    // TODO: 실제 테스트용 AI 음성 버퍼 반환
    const audioBuffer = await this.openAIService.textToSpeech(aiResponse);

    // TODO: TTS 임시 비활성화 (비용 절감)
    // const audioBuffer = Buffer.from(''); // 빈 버퍼 반환

    return {
      topics: selectedTopic,
      select: 'true',
      aiResponseExploreWav: audioBuffer,
      originalText: aiResponse
    };
  }

  /**
   * 🔄 다른 주제 그룹 요청 처리
   */
  private async handleDifferentGroupRequest(
    dto: ExploreTopicsRequestDto,
    previousTopics: string[]
  ): Promise<ExploreTopicsResponseDto> {
    const interests = await this.analyzeInterests(dto.sessionId);
    const newGroup = await this.selectTopicGroupWithAI(interests, previousTopics);
    const selectedTopics = this.getTopicsFromGroup(newGroup, previousTopics);
    
    this.previousTopicsMap.set(dto.sessionId, selectedTopics);
    
    const aiResponse = this.generateMessage(dto.name, selectedTopics, {
      isTimedOut: dto.isTimedOut,
      isFirstRequest: false
    });

    // TODO: 테스트용 AI 음성 버퍼 반환
    const audioBuffer = await this.openAIService.textToSpeech(aiResponse);
    
    // TODO: TTS 임시 비활성화 (비용 절감)
    // const audioBuffer = Buffer.from(''); // 빈 버퍼 반환

    return {
      topics: selectedTopics,
      select: 'false',
      aiResponseExploreWav: audioBuffer,
      originalText: aiResponse
    };
  }

  /**
   * 🔄 같은 그룹 내 다른 주제 요청 처리
   */
  private async handleSameGroupDifferentTopics(
    dto: ExploreTopicsRequestDto,
    previousTopics: string[]
  ): Promise<ExploreTopicsResponseDto> {
    const currentGroup = Object.keys(this.dynamicTopicGroups)[0];
    const selectedTopics = this.getTopicsFromGroup(currentGroup, previousTopics);
    
    this.previousTopicsMap.set(dto.sessionId, selectedTopics);
    
    const aiResponse = this.generateMessage(dto.name, selectedTopics, {
      isTimedOut: dto.isTimedOut,
      isFirstRequest: false
    });

    // TODO: 실제 테스트용 AI 음성 버퍼 반환
      const audioBuffer = await this.openAIService.textToSpeech(aiResponse);

    // TODO: TTS 임시 비활성화 (비용 절감)
    // const audioBuffer = Buffer.from(''); // 빈 버퍼 반환

    return {
      topics: selectedTopics,
      select: 'false',
      aiResponseExploreWav: audioBuffer,
      originalText: aiResponse
    };
  }

  // 🤖 AI 관련 유틸리티 함수들
  /**
   * 🗣️ 사용자 응답 분석
   */
  private async analyzeUserResponse(
    userText: string,
    lastConversation: ConversationDocument | null
  ): Promise<{
    selectedTopic: string | null;
    confirmedTopic: boolean;
    wantsDifferentGroup: boolean;
    wantsDifferentTopics: boolean;
  }> {
    // 이전 대화에서 선택된 토픽 추출
    let previousTopic = null;
    let isTopicProposed = false;
    
    if (lastConversation?.aiResponse) {
      this.logger.log('이전 대화에서 선택된 토픽 추출');
      const matchConfirm = lastConversation.aiResponse.match(/(.+)가 맞나요\?/);
      if (matchConfirm) {
        this.logger.log('이전 대화에서 제안된 토픽 발견');
        previousTopic = matchConfirm[1];
        isTopicProposed = true;
      }
    }

    const systemPrompt = 
      `당신은 노인 사용자의 응답을 분석하는 AI 어시스턴트입니다.
      
      중요한 규칙:
      1. 토픽 선택과 확정은 반드시 두 단계로 진행됩니다.
      2. 새로운 토픽이 언급되면 항상 선택 단계로 처리합니다 (confirmedTopic: false).
      3. 확정(confirmedTopic: true)은 다음 경우에만 가능합니다:
         - 이전 대화에서 "~가 맞나요?"라고 제안된 토픽에 대해
         - 사용자가 명확한 긍정의 응답을 한 경우만
         - 긍정 응답 예시: "네", "좋아요", "그래요", "할게요"
      4. 단순히 토픽을 언급하는 것은 항상 선택으로 처리합니다.
         예시: "바나나" → selectedTopic: "바나나", confirmedTopic: false
      5. 이전 대화에서 제안되지 않은 새로운 토픽은 무조건 선택 단계로 처리합니다.
      
      응답 형식:
      {
        "selectedTopic": string | null,   // 선택한 주제 또는 이전 대화의 주제
        "confirmedTopic": boolean,        // 주제 확정 여부
        "wantsDifferentGroup": boolean,   // 다른 그룹 요청 여부
        "wantsDifferentTopics": boolean   // 같은 그룹 내 다른 주제 요청 여부
      }`;

    const analysisPrompt = 
     `현재 상황:
      - 이전 제안된 토픽: ${previousTopic || '없음'}
      - 토픽 제안 여부: ${isTopicProposed ? '예 (확정 가능)' : '아니오 (선택 단계 필요)'}
      - 이전 대화 내용: ${lastConversation ? lastConversation.aiResponse : '없음'}
      - 사용자 응답: "${userText}"

      분석 필요 사항:
      1. 사용자가 특정 주제를 언급했나요?
      2. 이전에 제안된 주제에 대한 확실한 긍정 응답인가요?
      3. 다른 주제나 그룹을 원하나요?

      주의사항:
      - 새로운 주제 언급은 항상 선택 단계로 처리 (confirmedTopic: false)
      - 확정은 이전 제안된 주제에 대한 명확한 긍정 응답일 때만 가능`;
    
    this.logger.log(analysisPrompt);
    const analysisResponse = await this.openAIService.generateText(systemPrompt, analysisPrompt);
    return JSON.parse(analysisResponse);
  }

  /**
   * 💬 상황별 메시지 생성
   */
  private generateMessage(
    name: string,
    topics: string[] | string,
    options: {
      isTimedOut?: string,
      isFirstRequest?: boolean,
      isConfirmation?: boolean,
      isSelected?: boolean,
      guidelines?: string
    } = {}
  ): string {
    const { isTimedOut, isFirstRequest, isConfirmation, isSelected, guidelines } = options;
    
    // 주제가 선택된 경우
    if (isSelected && typeof topics === 'string') {
      if (isConfirmation) {
        return `${topics}가 맞나요?`;
      }
      return guidelines || `${topics}는 기본적인 형태를 잘 살리는 게 포인트예요. 한번 시작해볼까요?`;
    }

    // 주제 목록을 배열로 변환
    const topicsArray = Array.isArray(topics) ? topics : [topics];
    
    // 첫 요청인 경우
    if (isFirstRequest) {
      if (isTimedOut === 'true') {
        return `${name}님, 이제 그림을 그려보는 건 어떨까요? 저희가 몇 가지 단어를 제시해 볼게요. ${topicsArray.join(', ')} 중에서 어떤 게 마음에 드세요?`;
      }
      return `${name}님, ${topicsArray.join(', ')} 중에서 어떤 걸 그려보실래요?`;
    }
    
    // 기본 메시지
    return `${name}님, ${topicsArray.join(', ')} 중에서 선택해보세요.`;
  }

  // 🎨 주제 관련 유틸리티 함수들
  /**
   * 🔍 사용자의 관심사 분석
   */
  private async analyzeInterests(sessionId: string): Promise<string[]> {
    this.logger.log(`사용자 관심사 분석 시작`);
    const conversations = await this.conversationModel
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();

    const interests = new Set<string>();
    conversations.forEach(conv => {
      if (conv.interests) {
        conv.interests.forEach(interest => interests.add(interest));
      }
    });

    return Array.from(interests);
  }

  /**
   * 🎲 주제 그룹 생성
   */
  private async generateTopicGroups(interests: string[]): Promise<Record<string, string[]>> { 
    this.logger.log(`주제 그룹 생성 시작`);
    const systemPrompt = `당신은 노인을 위한 그림 그리기 주제를 추천하는 AI 어시스턴트입니다.
                          반드시 순수한 JSON 형식으로만 응답하세요.
                          마크다운 코드 블록이나 다른 텍스트를 절대 포함하지 마세요.

                          응답 형식:
                          {
                            "그룹명1": ["주제1", "주제2", "주제3"],
                            "그룹명2": ["주제1", "주제2", "주제3"]
                          }

                          중요한 규칙:
                          1. 각 그룹은 정확히 3개의 주제를 포함해야 합니다.
                          2. 그룹명과 주제는 매우 간단하고 명확해야 합니다.
                          3. 그룹 예시: "과일", "동물", "필기도구", "가구", "채소" 등
                          4. 주제 예시: 
                            - 과일 그룹: "사과", "바나나", "배"
                            - 동물 그룹: "강아지", "고양이", "토끼"
                            - 필기도구 그룹: "연필", "볼펜", "지우개"
                          5. 모든 단어는 한글로 작성하세요.
                          6. 모든 따옴표는 큰따옴표(")를 사용하세요.
                          7. 복잡하거나 추상적인 주제는 피하세요.
                          8. 꽃, 나무 등의 상위 개념보다 명확하게 추천해주세요.
                            8-1. 예시 : 꽃 이라면 "해바라기", "장미" 나무라면 "버드나무", "소나무" 등으로 작성하세요.
                          
                          주의: 응답에는 순수한 JSON만 포함되어야 합니다. 다른 텍스트나 마크다운은 절대 사용하지 마세요.`;

    const userInput = interests.length > 0
      ? `다음 관심사를 반영한 그림 그리기 주제 그룹을 생성해주세요: ${interests.join(', ')}`
      : `노인분들이 쉽게 그릴 수 있는 간단한 주제 그룹을 생성해주세요.`;

    try {
      const response = await this.openAIService.generateText(systemPrompt, userInput);
      
      // JSON 형식 검증
      try {
        const parsedResponse = JSON.parse(response);
        
        // 응답 구조 검증
        if (typeof parsedResponse !== 'object' || Array.isArray(parsedResponse)) {
          throw new Error('응답이 객체 형식이 아닙니다');
        }

        // 각 그룹이 배열을 값으로 가지는지 검증
        for (const [groupName, topics] of Object.entries(parsedResponse)) {
          if (!Array.isArray(topics)) {
            throw new Error(`${groupName} 그룹의 주제가 배열 형식이 아닙니다`);
          }
          if (topics.length < 3) {
            throw new Error(`${groupName} 그룹의 주제가 3개 미만입니다`);
          }
        }

        return parsedResponse;
      } catch (parseError) {
        this.logger.error('AI 응답 파싱 실패:', response);
        this.logger.error('파싱 에러:', parseError);
        return this.DEFAULT_GROUP;
      }
    } catch (error) {
      this.logger.error(`주제 그룹 생성 실패: ${error.message}`, error.stack);
      return this.DEFAULT_GROUP;
    }
  }

  /**
   * 🎯 주제 그룹 선택
   */
  private async selectTopicGroupWithAI(interests: string[], previousTopics: string[] = []): Promise<string> {
    this.logger.log(`주제 그룹 선택 시작`);
    const availableGroups = Object.keys(this.dynamicTopicGroups);
    
    if (availableGroups.length === 0) {
      this.logger.error('사용 가능한 그룹이 없습니다');
      this.dynamicTopicGroups = this.DEFAULT_GROUP;
      return Object.keys(this.DEFAULT_GROUP)[0];
    }

    const systemPrompt = `
      당신은 노인을 위한 그림 그리기 주제 그룹을 선택하는 AI 어시스턴트입니다.
      아래 주어진 그룹 중에서 하나만 선택해야 합니다:
      ${availableGroups.join(', ')}

      선택한 그룹 이름만 정확히 응답하세요. 다른 텍스트는 포함하지 마세요.
      이전에 추천된 주제와는 다른 새로운 그룹을 선택하세요.
    `;

    const userInput = interests.length > 0
      ? `사용자의 관심사: ${interests.join(', ')}\n이전에 추천된 주제들: ${previousTopics.join(', ')}`
      : `이전에 추천된 주제들: ${previousTopics.join(', ')}\n노인분들이 쉽게 그릴 수 있는 주제 그룹을 선택해주세요.`;

    this.logger.log(`사용 가능한 그룹:`, availableGroups);
    const selectedGroup = await this.openAIService.generateText(systemPrompt, userInput);
    
    // 선택된 그룹이 실제 존재하는지 확인
    if (!this.dynamicTopicGroups[selectedGroup]) {
      this.logger.error(`AI가 선택한 그룹 "${selectedGroup}"이 존재하지 않습니다`);
      return availableGroups[0]; // 첫 번째 그룹 반환
    }

    return selectedGroup;
  }

  /**
   * 🎯 주제 선택
   */
  private getTopicsFromGroup(group: string, exclude: string[] = []): string[] {
    this.logger.log(`주제 선택 시작`);
    const topics = (this.dynamicTopicGroups[group] || []).filter(topic => !exclude.includes(topic));
    if (topics.length === 0) {
      this.logger.log(`기본 주제 생성`);
      return this.generateFallbackTopics();
    }
    this.logger.log(`주제 선택 완료`);
    return topics.sort(() => 0.5 - Math.random()).slice(0, 3);
  }

  /**
   * 🎨 기본 주제 생성
   */
  private generateFallbackTopics(): string[] {
    return this.DEFAULT_GROUP[Object.keys(this.DEFAULT_GROUP)[0]];
  }

  // 🎨 주제 메타데이터 관련 함수들
  /**
   * 🎨 그리기 가이드라인 생성
   */
  private async generateDrawingGuidelines(
    topic: string, 
    userPreferences: any = null
  ): Promise<{ guidelines: string; imageUrl: string }> {
    const guidelinePrompt = `
      주제: ${topic}
      ${userPreferences ? `사용자 선호도: ${JSON.stringify(userPreferences)}` : ''}

      위 주제에 대한 그림 그리기 가이드라인을 생성해주세요.
      다음 내용을 포함해야 합니다:
      1. 기본 형태와 구도
      2. 주요 특징과 세부 사항
      3. 색상 추천
      4. 단계별 그리기 방법
      5. 초보자를 위한 팁

      자연스러운 대화체로 설명해주세요.
    `;

    const guidelines = await this.openAIService.generateText(guidelinePrompt);

    const imagePrompt = `
      주제: ${topic}
      스타일: 간단하고 명확한 선화 스타일, 초보자도 따라 그리기 쉬운 기본적인 형태
      특징: 
      - 주요 형태와 구도가 명확히 보이도록
      - 단순화된 형태로 표현
      - 흑백 또는 연한 색상으로 표현
      - 그림자나 질감 표현은 최소화
    `;

    const dallEImageUrl = await this.openAIService.generateImage(imagePrompt);
    const key = `topics/${topic}/${Date.now()}.png`;
    const s3ImageUrl = await this.s3Service.uploadImageFromUrl(dallEImageUrl, key);

    return {
      guidelines,
      imageUrl: s3ImageUrl
    };
  }

  // /**
  //  * 🔍 메타데이터 조회
  //  */
  // private async checkTopicMetadata(topic: string): Promise<SpringMetadataResponse | null> {
  //   try {
  //     this.logger.debug('메타데이터 조회 시작');
  //     const response = await fetch(`${process.env.SPRING_API_URL}/canvas/checkmetadata`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({ topicName: topic })
  //     });

  //     if (response.ok) {
  //       const metadata = await response.json() as SpringMetadataResponse;
  //       this.logger.debug('Found existing metadata:', metadata);
  //       return metadata;
  //     }

  //     if (response.status === 500) {
  //       this.logger.debug('No metadata found for topic:', topic);
  //       return null;
  //     }

  //     throw new Error(`Unexpected response: ${response.status} - ${response.statusText}`);
  //   } catch (error) {
  //     this.logger.error(`Error checking metadata: ${error.message}`, error.stack);
  //     return null;
  //   }
  // }

  // /**
  //  * 💾 메타데이터 저장
  //  */
  // private async saveTopicMetadata(metadata: SpringMetadataResponse): Promise<SpringMetadataResponse | null> {
  //   try {
  //     const response = await fetch(`${process.env.SPRING_API_URL}/canvas/savemetadata`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify(metadata)
  //     });

  //     if (!response.ok) {
  //       throw new Error(`Failed to save metadata: ${response.status} - ${response.statusText}`);
  //     }

  //     const savedData = await response.json() as SpringMetadataResponse;
  //     this.logger.debug('Successfully saved metadata:', savedData);
  //     return savedData;
  //   } catch (error) {
  //     this.logger.error(`Error saving metadata: ${error.message}`, error.stack);
  //     return null;  
  //   }
  // }
// 이거 나중에 지워주셈 주석
  /**
   * 🔄 메타데이터 처리
   */
  private async handleTopicMetadata(topic: string): Promise<SpringMetadataResponse | null> {
    // 테스트를 위해 하드코딩된 메타데이터 반환
    return {
      topicName: topic,
      imageUrl: 'https://bbanana.s3.ap-northeast-2.amazonaws.com/canvas-image-step-1-8880922c-a73d-4818-a183-092d8d4bd2f4-MmMv5EdN.png',
      description: `${topic}는 기본적인 형태를 잘 살리는 게 포인트예요. 한번 시작해볼까요?`
    };

    /* 기존 메타데이터 처리 로직
    const existingMetadata = await this.checkTopicMetadata(topic);
    if (existingMetadata) {
      return existingMetadata;
    }

    this.logger.log('메타데이터 생성 시작');
    // const { guidelines, imageUrl } = await this.generateDrawingGuidelines(topic);
    const guidelines = '이거 맞디~';
    const imageUrl = 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-VA11vTq5rYfo63AMCo370lYA/user-JeR40qlqTe9ZjKLkgf3BGbl1/img-vxsl0PojFefAONCCoaeRSwfc.png?st=2025-01-12T10%3A30%3A13Z&se=2025-01-12T12%3A30%3A13Z&sp=r&sv=2024-08-04&sr=b&rscd=inline&rsct=image/png&skoid=d505667d-d6c1-4a0a-bac7-5c84a87759f8&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-01-12T00%3A43%3A20Z&ske=2025-01-13T00%3A43%3A20Z&sks=b&skv=2024-08-04&sig=LnDHnaEIKFKBiD%2BfDnnOI8LmQvETKqc4wWOaHAo80tY%3D';
    
    const newMetadata = {
      topicName: topic,
      imageUrl: imageUrl,
      description: guidelines
    };

    return await this.saveTopicMetadata(newMetadata);
    */
  }

} 