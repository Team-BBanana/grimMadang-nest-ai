import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';
import { SubmitDrawingRequestDto, SubmitDrawingResponseDto } from './dto/submit-drawing.dto';

@Injectable()
export class DrawingsService {
  private readonly logger = new Logger(DrawingsService.name);
  private readonly PASS_THRESHOLD = 80;

  constructor(
    private readonly openAIService: OpenAIService
  ) {}

  /**
   * 🎨 그림 제출 및 평가 - 메인로직 
   */
  async evaluateDrawing(request: SubmitDrawingRequestDto): Promise<SubmitDrawingResponseDto> {
    try {
      // 🤖 AI 이미지 분석 및 점수 산정
      const { score, feedback } = await this.analyzeDrawing(request);
      
      // 🎯 통과 여부 판단
      const passed = score >= this.PASS_THRESHOLD;
      
      // 🗣️ AI 피드백 텍스트 생성 (예: "곡선 표현이 너무 잘 살았어요! 다음 단계로 넘어가겠습니다!")
      const feedbackMessage = this.generateFeedbackMessage(passed, score, feedback);
      
      // 🎤 텍스트를 음성으로 변환 (MP3 버퍼로 변환)
      const aiFeedbackWav = await this.openAIService.textToSpeech(feedbackMessage);

      return {
        score,
        passed,
        aiFeedbackWav
      };
    } catch (error) {
      this.logger.error(`Error evaluating drawing: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 🔍 AI 이미지 분석
   */
  private async analyzeDrawing(request: SubmitDrawingRequestDto): Promise<{ score: number; feedback: string }> {
    const prompt = this.generateAnalysisPrompt(request.topic, request.phase);
    
    // 🖼️ 이미지 분석 요청
    const analysis = await this.openAIService.analyzeImage(request.imageData, prompt);
    
    // 📊 점수 및 피드백 추출
    const score = this.extractScore(analysis);
    const feedback = this.extractFeedback(analysis);

    return { score, feedback };
  }

  /**
   * 📝 분석 프롬프트 생성
   */
  private generateAnalysisPrompt(topic: string, phase: number): string {
    if (phase === 1) {
      return `이 그림이 '${topic}'의 기본적인 형태를 얼마나 잘 표현했는지 분석해주세요. 
      선의 형태, 전체적인 모양, 비율 등을 고려하여 100점 만점으로 점수를 매겨주세요.
      점수와 함께 구체적인 피드백도 제공해주세요.`;
    } else {
      return `이 그림이 '${topic}'의 세부적인 특징을 얼마나 잘 표현했는지 분석해주세요.
      색감, 질감, 디테일한 특징 등을 고려하여 100점 만점으로 점수를 매겨주세요.
      점수와 함께 구체적인 피드백도 제공해주세요.`;
    }
  }

  /**
   * 💯 점수 추출
   */
  private extractScore(analysis: string): number {
    // AI 응답에서 점수 추출 로직
    const scoreMatch = analysis.match(/(\d{1,3})점/);
    return scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1]))) : 0;
  }

  /**
   * 💭 피드백 추출
   */
  private extractFeedback(analysis: string): string {
    // AI 응답에서 피드백 내용 추출 로직
    const feedbackMatch = analysis.match(/피드백[:\s]*(.*)/i);
    return feedbackMatch ? feedbackMatch[1].trim() : '';
  }

  /**
   * 🗨️ 피드백 메시지 생성
   */
  private generateFeedbackMessage(passed: boolean, score: number, feedback: string): string {
    if (passed) {
      return `${feedback} 점수는 ${score}점으로, 아주 잘 그리셨어요! 다음 단계로 넘어가겠습니다!`;
    } else {
      return `${feedback} 점수는 ${score}점인데, 조금만 더 수정해보면 좋을 것 같아요. 다시 한번 도전해보시겠어요?`;
    }
  }
} 