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

    // 🎤 음성 데이터를 텍스트로 변환 (first가 아닌 경우)
    let userText = '';
    if (dto.userRequestExploreWav !== 'first') {
      const audioBuffer = Buffer.from(dto.userRequestExploreWav, 'base64');
      userText = await this.openAIService.speechToText(audioBuffer);
      this.logger.debug('Converted user speech to text:', userText);
    }

    // 📋 이전 추천 주제 가져오기
    this.logger.log('이전 추천 주제 가져오기');
    const previousTopics = this.previousTopicsMap.get(dto.sessionId) || [];

    // 👋 첫 방문 또는 새로운 세션 시작 시 처리
    if (dto.userRequestExploreWav === 'first') {
      const response = await this.handleFirstVisit(dto, previousTopics);
      
      // 🔢 현재 세션의 마지막 대화 순서 조회
      const lastConversation = await this.conversationModel
        .findOne({ sessionId: dto.sessionId })
        .sort({ conversationOrder: -1 });
      
      const nextOrder = lastConversation ? lastConversation.conversationOrder + 1 : 1;
      
      await this.conversationModel.create({
        sessionId: dto.sessionId,
        name: dto.name,
        userText: '첫 방문',
        aiResponse: response.aiText,
        conversationOrder: nextOrder
      });
      return {
        topics: response.topics,
        select: response.select,
        aiResponseExploreWav: response.aiResponseExploreWav
      };
    }

    // 🔍 사용자의 응답 분석
    const analysis = await this.analyzeUserResponse(userText);

    // 🎯 사용자가 특정 주제를 선택한 경우 (확정은 아직)
    if (analysis.selectedTopic && !analysis.confirmedTopic) {
      const response = await this.handleTopicSelection(analysis.selectedTopic, dto.name, dto.isTimedOut);
      
      // 🔢 현재 세션의 마지막 대화 순서 조회
      const lastConversation = await this.conversationModel
        .findOne({ sessionId: dto.sessionId })
        .sort({ conversationOrder: -1 });
      
      const nextOrder = lastConversation ? lastConversation.conversationOrder + 1 : 1;
      
      await this.conversationModel.create({
        sessionId: dto.sessionId,
        name: dto.name,
        userText: userText,
        aiResponse: response.aiResponseExploreWav,
        conversationOrder: nextOrder
      });
      return response;
    }

    // ✅ 사용자가 주제를 확정한 경우
    if (analysis.confirmedTopic) {
      const response = await this.handleTopicConfirmation(previousTopics[0], dto.name);
      await this.conversationModel.create({
        sessionId: dto.sessionId,
        name: dto.name,
        userText: userText,
        aiResponse: response.aiResponseExploreWav
      });
      return response;
    }

    // 🔄 사용자가 다른 주제 그룹을 원하는 경우
    if (analysis.wantsDifferentGroup) {
      const response = await this.handleDifferentGroupRequest(dto, previousTopics);
      await this.conversationModel.create({
        sessionId: dto.sessionId,
        name: dto.name,
        userText: userText,
        aiResponse: response.aiResponseExploreWav
      });
      return response;
    }

    // 🎨 현재 그룹에서 다른 주제를 원하는 경우 (기본 케이스)
    const response = await this.handleSameGroupDifferentTopics(dto, previousTopics);
    await this.conversationModel.create({
        sessionId: dto.sessionId,
        name: dto.name,
        userText: userText,
        aiResponse: response.aiResponseExploreWav
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
  ): Promise<ExploreTopicsResponseDto & { aiText: string }> {
    // 📝 사용자의 관심사 분석
    const interests = await this.analyzeInterests(dto.sessionId);
    // 🎲 주제 그룹 생성
    this.dynamicTopicGroups = await this.generateTopicGroups(interests);
    // 🎯 주제 그룹 선택
    const group = await this.selectTopicGroupWithAI(interests);
    // 📚 주제 선택
    const selectedTopics = this.getTopicsFromGroup(group);
    // 📝 이전 추천 주제 저장
    this.previousTopicsMap.set(dto.sessionId, selectedTopics);
    // 🎤 AI 응답 생성
    const aiResponse = await this.generateAIResponse(
      dto.name,
      selectedTopics,
      dto.isTimedOut,
      true
    );
    // 🎤 AI 음성 응답 생성
    const audioBuffer = await this.openAIService.textToSpeech(aiResponse);
    // 📝 응답 반환 (텍스트 포함)
    return {
      topics: selectedTopics,
      select: 'false',
      aiResponseExploreWav: audioBuffer,
      aiText: aiResponse
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
    const audioBuffer = await this.openAIService.textToSpeech(aiResponse);
    const base64Audio = audioBuffer;

    return {
      topics: selectedTopic,
      select: 'false',
      aiResponseExploreWav: base64Audio,
      metadata: metadata || undefined
    };
  }

  /**
   * ✅ 주제 확정 처리
   */
  private async handleTopicConfirmation(
    selectedTopic: string,
    name: string
  ): Promise<ExploreTopicsResponseDto> {
    await this.deleteTemporaryMetadata(selectedTopic);

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
    const audioBuffer = await this.openAIService.textToSpeech(aiResponse);

    return {
      topics: selectedTopic,
      select: 'true',
      aiResponseExploreWav: audioBuffer
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
    
    const aiResponse = await this.generateAIResponse(
      dto.name,
      selectedTopics,
      dto.isTimedOut,
      false
    );

    const audioBuffer = await this.openAIService.textToSpeech(aiResponse);
    return {
      topics: selectedTopics,
      select: 'false',
      aiResponseExploreWav: audioBuffer
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
    
    const aiResponse = await this.generateAIResponse(
      dto.name,
      selectedTopics,
      dto.isTimedOut,
      false
    );

    const audioBuffer = await this.openAIService.textToSpeech(aiResponse);
    return {
      topics: selectedTopics,
      select: 'false',
      aiResponseExploreWav: audioBuffer
    };
  }

  // 🤖 AI 관련 유틸리티 함수들
  /**
   * 🗣️ 사용자 응답 분석
   */
  private async analyzeUserResponse(userText: string): Promise<{
    selectedTopic: string | null;
    confirmedTopic: boolean;
    wantsDifferentGroup: boolean;
    wantsDifferentTopics: boolean;
  }> {
    const analysisPrompt = `다음 노인 사용자의 응답을 분석해주세요. 응답: "${userText}"
      1. 특정 주제를 선택했나요? (예: "참외가 좋겠다", "참외로 할까요?")
      2. 선택한 주제를 확정했나요? (예: "네", "좋아요", "그걸로 할게요", "참외가 맞아요")
      3. 다른 종류의 주제를 원하나요?
      4. 현재 주제 그룹에서 다른 주제를 원하나요?

      JSON 형식으로 응답해주세요: { 
        "selectedTopic": string | null,  // 선택한 주제 (있는 경우)
        "confirmedTopic": boolean,       // 주제 확정 여부
        "wantsDifferentGroup": boolean,  // 다른 그룹 요청 여부
        "wantsDifferentTopics": boolean  // 같은 그룹 내 다른 주제 요청 여부
      }`;
    
    const analysisResponse = await this.openAIService.generateText(analysisPrompt);
    return JSON.parse(analysisResponse);
  }

  /**
   * 💬 AI 응답 생성
   */
  private async generateAIResponse(
    name: string,
    topics: string[] | string,
    isTimedOut: string,
    isFirstRequest: boolean,
    isConfirmation: boolean = false,
    isSelected: boolean = false,
    guidelines: string = ''
  ): Promise<string> {
    let prompt = '';
    
    if (isSelected && typeof topics === 'string') {
      if (isConfirmation) {
        prompt = `${topics}가 맞나요?`;
      } else {
        prompt = `${guidelines || `${topics}는 기본적인 형태를 잘 살리는 게 포인트예요. 한번 시작해볼까요?`}`;
      }
    } 
    else if (isFirstRequest) {
      const topicsArray = Array.isArray(topics) ? topics : [topics];
      if (isTimedOut === 'true') {
        prompt = `${name}님, 이제 그림을 그려보는 건 어떨까요? 저희가 몇 가지 단어를 제시해 볼게요. 
                ${topicsArray.join(', ')} 중에서 어떤 게 마음에 드세요?`;
      } else {
        prompt = `${name}님, ${topicsArray.join(', ')} 중에서 어떤 걸 그려보실래요?`;
      }
    } 
    else {
      const topicsArray = Array.isArray(topics) ? topics : [topics];
      prompt = `${topicsArray.join(', ')} 중에서 어떤 걸 그려보실래요?`;
    }

    return this.openAIService.generateText(prompt);
  }

  // 🎨 주제 관련 유틸리티 함수들
  /**
   * 🔍 사용자의 관심사 분석
   */
  private async analyzeInterests(sessionId: string): Promise<string[]> {
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
    const prompt = `
      사용자의 관심사: ${interests.join(', ')}

      위 관심사를 바탕으로 그림 그리기에 적합한 주제 그룹과 각 그룹별 주제를 생성해주세요.
      각 그룹은 5-9개의 주제를 포함해야 합니다.
      JSON 형식으로 응답해주세요:
      {
        "그룹명1": ["주제1", "주제2", ...],
        "그룹명2": ["주제1", "주제2", ...],
        ...
      }
    `;

    const response = await this.openAIService.generateText(prompt);
    return JSON.parse(response);
  }

  /**
   * 🎯 주제 그룹 선택
   */
  private async selectTopicGroupWithAI(interests: string[], previousTopics: string[] = []): Promise<string> {
    const prompt = `
      사용자의 관심사: ${interests.join(', ')}
      이전에 추천된 주제들: ${previousTopics.join(', ')}

      위 정보를 바탕으로 사용자에게 가장 적합한 주제 그룹을 선택해주세요.
      이전에 추천된 주제와는 다른 새로운 그룹을 선택하되, 사용자의 관심사와 연관성이 높아야 합니다.
      그룹 이름만 응답해주세요.
    `;

    return await this.openAIService.generateText(prompt);
  }

  /**
   * 🎯 주제 선택
   */
  private getTopicsFromGroup(group: string, exclude: string[] = []): string[] {
    const topics = (this.dynamicTopicGroups[group] || []).filter(topic => !exclude.includes(topic));
    if (topics.length === 0) {
      return this.generateFallbackTopics();
    }
    return topics.sort(() => 0.5 - Math.random()).slice(0, 3);
  }

  /**
   * 🎨 기본 주제 생성
   */
  private generateFallbackTopics(): string[] {
    const defaultTopics = ['사과', '바나나', '배'];
    return defaultTopics.sort(() => 0.5 - Math.random()).slice(0, 3);
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

  /**
   * 🔍 메타데이터 조회
   */
  private async checkTopicMetadata(topic: string): Promise<SpringMetadataResponse | null> {
    try {
      const response = await fetch(`${process.env.SPRING_API_URL}/canvas/checkmetadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topicName: topic })
      });

      if (response.ok) {
        const metadata = await response.json() as SpringMetadataResponse;
        this.logger.debug('Found existing metadata:', metadata);
        return metadata;
      }

      if (response.status === 500) {
        this.logger.debug('No metadata found for topic:', topic);
        return null;
      }

      throw new Error(`Unexpected response: ${response.status} - ${response.statusText}`);
    } catch (error) {
      this.logger.error(`Error checking metadata: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * 💾 메타데이터 저장
   */
  private async saveTopicMetadata(metadata: SpringMetadataResponse): Promise<SpringMetadataResponse | null> {
    try {
      const response = await fetch(`${process.env.SPRING_API_URL}/canvas/savemetadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) {
        throw new Error(`Failed to save metadata: ${response.status} - ${response.statusText}`);
      }

      const savedData = await response.json() as SpringMetadataResponse;
      this.logger.debug('Successfully saved metadata:', savedData);
      return savedData;
    } catch (error) {
      this.logger.error(`Error saving metadata: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * 🔄 메타데이터 처리
   */
  private async handleTopicMetadata(topic: string): Promise<SpringMetadataResponse | null> {
    const existingMetadata = await this.checkTopicMetadata(topic);
    if (existingMetadata) {
      return existingMetadata;
    }

    const { guidelines, imageUrl } = await this.generateDrawingGuidelines(topic);
    
    const newMetadata = {
      topicName: topic,
      imageUrl: imageUrl,
      description: guidelines
    };

    return await this.saveTopicMetadata(newMetadata);
  }

  /**
   * 🗑️ 임시 메타데이터 삭제
   */
  private async deleteTemporaryMetadata(topic: string): Promise<void> {
    try {
      const response = await fetch(`${process.env.SPRING_API_URL}/canvas/deletemetadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topicName: topic })
      });

      if (!response.ok) {
        throw new Error(`Failed to delete metadata: ${response.status} - ${response.statusText}`);
      }

      this.logger.debug(`Successfully deleted temporary metadata for topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Error deleting temporary metadata: ${error.message}`, error.stack);
    }
  }
} 