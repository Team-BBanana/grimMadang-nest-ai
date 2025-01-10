import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Topic, TopicDocument } from './schemas/topic.schema';
import { ExploreTopicsRequestDto, ExploreTopicsResponseDto, TopicImageDescriptionResponseDto } from './dto/explore.dto';
import { OpenAIService } from '../openai/openai.service';
import { ConversationDocument } from '../conversation/schemas/conversation.schema';
import fetch from 'node-fetch';

// Spring API 응답 타입 정의
interface SpringMetadataResponse {
  topicName: string;
  imageUrl: string;
  description: string;
}

@Injectable()
export class TopicsService {
  private readonly logger = new Logger('주제 추천 서비스');

  // 이전 추천 주제를 저장하는 맵
  private previousTopicsMap = new Map<string, string[]>();

  // 🎨 주제 그룹 저장을 위한 private 변수
  private dynamicTopicGroups: Record<string, string[]> = {};

  constructor(
    @InjectModel(Topic.name) private topicModel: Model<TopicDocument>,
    @InjectModel('Conversation') private conversationModel: Model<ConversationDocument>,
    private readonly openAIService: OpenAIService
  ) {}

  /** 🔍 ConversationDocument 테이블을 조회, 최근 10개의 row 가져옴
   * 사용자의 이전 대화에서 관심사를 분석하는 메서드
   * @param sessionId - 사용자 세션 ID
   * @returns 분석된 관심사 목록
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

  /** 🎲 사용자의 관심사를 바탕으로 그림 그리기에 적합한 주제 그룹을 동적으로 생성
   * 사용자의 관심사를 바탕으로 그림 그리기에 적합한 주제 그룹을 동적으로 생성
   * @param interests - 사용자의 관심사 목록
   * @returns 생성된 주제 그룹 (그룹명: 주제 목록)
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

  /** 🎯 사용자의 관심사와 이전 추천 이력을 고려하여 적절한 주제 그룹을 선택
   * @param interests - 사용자의 관심사 목록
   * @param previousTopics - 이전에 추천된 주제 목록
   * @returns 선택된 주제 그룹명
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

  /** 🎯 주어진 그룹에서 3개의 주제를 무작위로 선택
   * @param group - 주제 그룹명
   * @param exclude - 제외할 주제 목록 (이전에 추천된 주제들)
   * @returns 선택된 3개의 주제
   */
  private getTopicsFromGroup(group: string, exclude: string[] = []): string[] {
    const topics = (this.dynamicTopicGroups[group] || []).filter(topic => !exclude.includes(topic));
    if (topics.length === 0) {
      return this.generateFallbackTopics();
    }
    return topics.sort(() => 0.5 - Math.random()).slice(0, 3);
  }

  /**
   * 적절한 주제를 찾지 못했을 때 사용할 기본 주제 생성
   * @returns 기본 주제 3개
   */
  private generateFallbackTopics(): string[] {
    const defaultTopics = ['사과', '바나나', '배'];
    return defaultTopics.sort(() => 0.5 - Math.random()).slice(0, 3);
  }

  // 🎨 주제별 상세 가이드라인 생성
  /**
   * 선택된 주제에 대한 상세한 그리기 가이드라인과 예시 이미지 생성
   * @param topic - 선택된 주제
   * @param userPreferences - 사용자의 선호도 정보 (난이도, 스타일 등)
   * @returns 생성된 그리기 가이드라인과 이미지 URL
   */
  private async generateDrawingGuidelines(
    topic: string, 
    userPreferences: any = null
  ): Promise<{ guidelines: string; imageUrl: string }> {
    // 1. 가이드라인 생성
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

    // 2. 예시 이미지 생성
    const imagePrompt = `
      주제: ${topic}
      스타일: 간단하고 명확한 선화 스타일, 초보자도 따라 그리기 쉬운 기본적인 형태
      특징: 
      - 주요 형태와 구도가 명확히 보이도록
      - 단순화된 형태로 표현
      - 흑백 또는 연한 색상으로 표현
      - 그림자나 질감 표현은 최소화
    `;

    const imageUrl = await this.openAIService.generateImage(imagePrompt);

    return {
      guidelines,
      imageUrl
    };
  }

  /**
   * 주제에 대한 메타데이터 조회
   * @param topic - 조회할 주제 이름
   * @returns 메타데이터 또는 null (데이터가 없는 경우)
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
   * 주제 메타데이터 저장
   * @param metadata - 저장할 메타데이터
   * @returns 저장된 메타데이터 또는 null (저장 실패 시)
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
   * 주제 메타데이터 처리 (조회 또는 생성)
   * @param topic - 처리할 주제 이름
   * @returns 메타데이터 또는 null (처리 실패 시)
   */
  private async handleTopicMetadata(topic: string): Promise<SpringMetadataResponse | null> {
    // 1. 기존 메타데이터 조회
    const existingMetadata = await this.checkTopicMetadata(topic);
    if (existingMetadata) {
      return existingMetadata;
    }

    // 2. 메타데이터가 없는 경우, 새로 생성
    const { guidelines, imageUrl } = await this.generateDrawingGuidelines(topic);
    
    // 3. 생성된 메타데이터 저장
    const newMetadata = {
      topicName: topic,
      imageUrl: imageUrl,
      description: guidelines
    };

    return await this.saveTopicMetadata(newMetadata);
  }

  // 🎨 AI 응답 생성
  /**
   * AI 응답을 생성하는 메서드
   * @param name - 사용자 이름
   * @param topics - 추천된 주제들 (배열) 또는 선택된 주제 (문자열)
   * @param isTimedOut - 시간 초과 여부 ('true' | 'false')
   * @param isFirstRequest - 첫 번째 요청인지 여부 (true: 첫 방문/새로운 세션 시작, false: 기존 대화 진행 중)
   * @param isConfirmation - 사용자의 주제 선택을 확인하는 단계인지 여부 (true: "~가 맞나요?" 형식의 응답 생성)
   * @param isSelected - 사용자가 특정 주제를 선택했는지 여부 (true: 선택된 주제에 대한 가이드라인 제공)
   * @param guidelines - 선택된 주제에 대한 상세 그리기 가이드라인 (선택된 주제가 있을 때만 사용)
   * @returns 생성된 AI 응답 텍스트
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
      // 사용자가 특정 주제를 선택한 경우
      if (isConfirmation) {
        // 선택한 주제 확인 단계
        prompt = `${topics}가 맞나요?`;
      } else {
        // 선택한 주제에 대한 가이드라인 제공 단계
        prompt = `${guidelines || `${topics}는 기본적인 형태를 잘 살리는 게 포인트예요. 한번 시작해볼까요?`}`;
      }
    } else if (isFirstRequest) {
      // 첫 번째 요청 또는 새로운 세션 시작
      const topicsArray = Array.isArray(topics) ? topics : [topics];
      if (isTimedOut === 'true') {
        // 시간 초과로 인한 자동 추천
        prompt = `${name}님, 이제 그림을 그려보는 건 어떨까요? 저희가 몇 가지 단어를 제시해 볼게요. 
                ${topicsArray.join(', ')} 중에서 어떤 게 마음에 드세요?`;
      } else {
        // 일반적인 첫 추천
        prompt = `${name}님, ${topicsArray.join(', ')} 중에서 어떤 걸 그려보실래요?`;
      }
    } else {
      // 기존 대화 진행 중 새로운 주제 추천
      const topicsArray = Array.isArray(topics) ? topics : [topics];
      prompt = `${topicsArray.join(', ')} 중에서 어떤 걸 그려보실래요?`;
    }

    return this.openAIService.generateText(prompt);
  }

  // 사용자가 특정 주제를 선택한 경우의 처리 로직
  private async handleTopicSelection(
    selectedTopic: string,
    name: string,
    isTimedOut: string
  ): Promise<ExploreTopicsResponseDto> {
    // 1. 메타데이터 처리
    const metadata = await this.handleTopicMetadata(selectedTopic);

    // 2. 선택 확인 메시지 생성
    const aiResponse = `${selectedTopic}가 맞나요?`;

    // 3. 음성 변환
    const audioBuffer = await this.openAIService.textToSpeech(aiResponse);
    const base64Audio = audioBuffer.toString('base64');

    // 4. 응답 반환
    return {
      topics: selectedTopic,
      select: 'false',
      aiResponseExploreWav: base64Audio,
      metadata: metadata || undefined
    };
  }

  /**
   * 임시 저장된 주제 메타데이터 삭제
   * @param topic - 삭제할 주제 이름
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
      // 삭제 실패는 크리티컬한 에러가 아니므로 무시하고 진행
    }
  }

  // 🎨 주제 추천
  // 메인로직
  /**
   * 사용자의 관심사와 대화 맥락을 기반으로 그림 그리기 주제를 추천하는 메인 메서드
   * @param dto - 주제 추천 요청 DTO (사용자 정보, 세션 ID, 음성 데이터 등)
   * @returns 추천된 주제와 AI 응답이 포함된 응답 DTO
   */
  async exploreTopics(dto: ExploreTopicsRequestDto): Promise<ExploreTopicsResponseDto> {
    this.logger.log(`Exploring topics for user: ${dto.name} (${dto.sessionId})`);

    // 음성 데이터를 텍스트로 변환 (first가 아닌 경우)
    let userText = '';  // 사용자의 음성을 텍스트로 변환한 결과를 저장
    if (dto.userRequestExploreWav !== 'first') {
      const audioBuffer = Buffer.from(dto.userRequestExploreWav, 'base64');
      userText = await this.openAIService.speechToText(audioBuffer);
      this.logger.debug('Converted user speech to text:', userText);
    }

    let selectedTopics: string[] | string;  // 추천된 주제들(배열) 또는 사용자가 선택한 주제(문자열)
    let select = 'false';  // 주제 선택 완료 여부 (true: 선택 완료, false: 선택 진행 중)
    let aiResponse: string;  // AI가 생성한 응답 텍스트

    // 이전에 추천했던 주제들을 가져와서 중복 추천 방지
    const previousTopics = this.previousTopicsMap.get(dto.sessionId) || [];

    // 첫 방문 또는 새로운 세션 시작 시 처리
    if (dto.userRequestExploreWav === 'first') {
      // 사용자의 관심사 분석
      const interests = await this.analyzeInterests(dto.sessionId);
      
      // 동적으로 주제 그룹 생성
      this.dynamicTopicGroups = await this.generateTopicGroups(interests);
      
      // AI를 통한 그룹 선택
      const group = await this.selectTopicGroupWithAI(interests);

      // 선택된 그룹에서 주제 3개 선택
      selectedTopics = this.getTopicsFromGroup(group);
      
      // 이전 추천 이력 저장
      this.previousTopicsMap.set(dto.sessionId, selectedTopics);
      
      // AI 응답 생성
      aiResponse = await this.generateAIResponse(
        dto.name,
        selectedTopics,
        dto.isTimedOut,
        true
      );

    // 첫 방문(frist)가 아닌 경우.
    } else {
      // 사용자의 응답을 분석하여 적절한 다음 단계 결정 프롬프트
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
      
      // 사용자 응답 분석
      const analysisResponse = await this.openAIService.generateText(analysisPrompt);
      
      // 사용자 응답 분석 결과
      const analysis = JSON.parse(analysisResponse);
      
      // 사용자가 특정 주제를 선택한 경우 (확정은 아직)
      if (analysis.selectedTopic && !analysis.confirmedTopic) {
        // 선택한 주제 확인 단계
        return await this.handleTopicSelection(analysis.selectedTopic, dto.name, dto.isTimedOut);

      } else if (analysis.confirmedTopic) {
        // 사용자가 주제를 확정한 경우
        selectedTopics = previousTopics[0];  // 이전에 선택했던 주제
        select = 'true';  // 그림판으로 이동하기 위한 플래그

        // 임시 데이터 삭제
        await this.deleteTemporaryMetadata(selectedTopics);

        // 확정 메시지 생성
        const confirmationPrompt = `
          주제: ${selectedTopics}
          상황: 노인 사용자가 해당 주제로 그림을 그리기로 확정했습니다.
          요구사항: 
          1. 그림을 그리기 시작하자는 긍정적이고 따뜻한 메시지를 생성해주세요.
          2. 해당 주제의 핵심적인 그리기 포인트를 간단히 언급해주세요.
          3. 자연스러운 대화체로 작성해주세요.
          예시: "좋아요, 바나나는 곡선을 살리는 게 포인트예요. 한번 시작해볼까요?"
        `;
        
        aiResponse = await this.openAIService.generateText(confirmationPrompt);
        
      // 사용자가 다른 주제를 원하는 경우
      } else if (analysis.wantsDifferentGroup) {
        // 사용자의 관심사 분석
        const interests = await this.analyzeInterests(dto.sessionId);
        
        // AI를 통한 그룹 선택
        const newGroup = await this.selectTopicGroupWithAI(interests, previousTopics);
        
        // 선택된 그룹에서 주제 3개 선택
        selectedTopics = this.getTopicsFromGroup(newGroup, previousTopics);
        
        // 이전 추천 이력 저장
        this.previousTopicsMap.set(dto.sessionId, selectedTopics);
        
        // AI 응답 생성
        aiResponse = await this.generateAIResponse(
          dto.name,
          selectedTopics,
          dto.isTimedOut,
          false
        );

        // 현재 그룹에서 다른 주제를 원하는 경우
      } else {
        const currentGroup = Object.keys(this.dynamicTopicGroups)[0];
        
        // 현재 그룹에서 주제 3개 선택
        selectedTopics = this.getTopicsFromGroup(currentGroup, previousTopics);
        
        // 이전 추천 이력 저장
        this.previousTopicsMap.set(dto.sessionId, selectedTopics);
        
        // AI 응답 생성
        aiResponse = await this.generateAIResponse(
          dto.name,
          selectedTopics,
          dto.isTimedOut,
          false
        );
      }
    }

    // AI 응답을 음성으로 변환
    const audioBuffer = await this.openAIService.textToSpeech(aiResponse);
    const base64Audio = audioBuffer.toString('base64');

    return {
      topics: selectedTopics,  // 추천된 주제들 또는 선택된 주제
      select,  // 주제 선택 완료 여부
      aiResponseExploreWav: base64Audio  // 음성으로 변환된 AI 응답
    };
  }

  // 🎨 주제 이미지 및 설명 생성
  /**
   * 주제 이미지 및 설명을 Spring 서버에 저장
   * @param topic - 선택된 주제
   * @param imageUrl - 생성된 이미지 URL
   * @param description - 생성된 가이드라인
   * @returns 저장된 주제 정보
   * @throws Error - Spring 서버 통신 실패 시
   */
  async makingTopicImageAndDescription(
    topic: string,
    imageUrl: string,
    description: string
  ): Promise<SpringMetadataResponse> {
    try {
      // 1. 기존 메타데이터 확인
      const checkResponse = await fetch(`${process.env.SPRING_API_URL}/canvas/checkmetadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topicName: topic })
      });

      // 2. 메타데이터가 있으면 그대로 반환
      if (checkResponse.ok) {
        const existingData = await checkResponse.json() as SpringMetadataResponse;
        this.logger.debug('Found existing metadata:', existingData);
        return existingData;
      }

      // 3. 메타데이터가 없으면 (500 에러) 새로 생성하여 저장
      if (checkResponse.status === 500) {
        this.logger.debug('No existing metadata found, creating new one');
        
        const saveResponse = await fetch(`${process.env.SPRING_API_URL}/canvas/savemetadata`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topicName: topic,
            imageUrl: imageUrl,
            description: description
          })
        });

        if (!saveResponse.ok) {
          throw new Error(`Failed to save metadata: ${saveResponse.status} - ${saveResponse.statusText}`);
        }

        const savedData = await saveResponse.json() as SpringMetadataResponse;
        this.logger.debug('Successfully saved new metadata:', savedData);
        return savedData;
      }

      // 4. 기타 에러 처리
      throw new Error(`Unexpected response from server: ${checkResponse.status} - ${checkResponse.statusText}`);
    } catch (error) {
      this.logger.error(`Error in makingTopicImageAndDescription: ${error.message}`, error.stack);
      
      // 기본 응답 반환 (에러 발생 시)
      return {
        topicName: topic,
        imageUrl: imageUrl,
        description: description
      };
    }
  }
} 