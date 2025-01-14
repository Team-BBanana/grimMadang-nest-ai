import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';
import { SubmitDrawingRequestDto, SubmitDrawingResponseDto } from './dto/submit-drawing.dto';

@Injectable()
export class DrawingsService {
  private readonly logger = new Logger(DrawingsService.name);
  private readonly PASS_THRESHOLD = 40;

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
      this.logger.log(`통과 여부: ${passed} + 점수 ${score} + 피드백 ${feedback}\n\n`);
      
      // 🗣️ AI 피드백 텍스트 생성 (예: "곡선 표현이 너무 잘 살았어요! 다음 단계로 넘어가겠습니다!")
      const feedbackMessage = this.generateFeedbackMessage(passed, score, feedback);
      this.logger.log(`AI 피드백 텍스트: ${feedbackMessage}`);
      
      // 🎤 텍스트를 음성으로 변환 (MP3 버퍼로 변환)
      // const aiFeedbackWav = await this.openAIService.textToSpeech(feedbackMessage);
      const aiFeedbackWav = Buffer.from(''); // 빈 버퍼 반환

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
    const basePrompt = `
      당신은 노인을 위한 그림 평가 전문가입니다.
      반드시 점수와 피드백을 제공해야 합니다.
      
      평가 규칙:
      1. 노인의 그림이므로 관대하게 평가하되, 너무 후하지 않게 평가합니다.
      2. 완성도와 노력을 균형있게 평가합니다.
      3. 점수는 반드시 "점수: XX점" 형식으로 포함해야 합니다.
      4. 피드백은 반드시 "피드백: " 으로 시작해야 합니다.
      5. 피드백은 긍정적이면서도 개선점을 함께 제시합니다.
      
      주제: '${topic}'`;

    if (phase === 1) {
      return `${basePrompt}
      
      1단계 (기본 형태) 평가 기준:
      - 전체적인 형태가 주제와 유사한가? (40점)
      - 크기와 비율이 적절한가? (30점)
      - 주요 특징이 표현되었는가? (30점)
      
      위 기준으로 평가하고 점수와 피드백을 제공해주세요.`;
    } else {
      return `${basePrompt}
      
      2단계 (세부 묘사) 평가 기준:
      - 색감이 적절한가? (35점)
      - 세부 특징이 표현되었는가? (35점)
      - 전체적인 완성도가 있는가? (30점)
      
      위 기준으로 평가하고 점수와 피드백을 제공해주세요.`;
    }
  }

  /**
   * 💯 점수 추출
   */
  private extractScore(analysis: string): number {
    // 점수 추출 로직 개선
    const scoreMatch = analysis.match(/점수:\s*(\d{1,3})/i) || analysis.match(/(\d{1,3})점/);
    if (!scoreMatch) {
      this.logger.warn('점수를 찾을 수 없음, 기본 점수 30점 반환');
      return 30; // 점수를 찾지 못할 경우 기본값으로 30점 반환
    }
    const score = Math.min(100, Math.max(0, parseInt(scoreMatch[1])));
    this.logger.debug(`추출된 점수: ${score}`);
    return score;
  }

  /**
   * 💭 피드백 추출
   */
  private extractFeedback(analysis: string): string {
    // 피드백 추출 로직 개선
    const feedbackMatch = analysis.match(/피드백:\s*(.*?)(?=점수:|$)/is);
    if (!feedbackMatch) {
      this.logger.warn('피드백을 찾을 수 없음, 기본 피드백 반환');
      return '그림을 잘 그리셨네요!';
    }
    return feedbackMatch[1].trim();
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