import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DrawingGuide, DrawingGuideDocument } from '../topics/schemas/drawing-guide.schema';
import { OpenAIService } from '../openai/openai.service';

@Injectable()
export class DrawingsService {
  private readonly logger = new Logger('그림 서비스');
  private readonly PASS_SCORE = 40;

  constructor(
    @InjectModel(DrawingGuide.name) private drawingGuideModel: Model<DrawingGuideDocument>,
    private readonly openAIService: OpenAIService
  ) {}

  /**
   * 🎨 그림 제출 및 평가 - 메인로직
   */
  async submitDrawing(
    sessionId: string,
    topic: string,
    userImageUrl: string,
    currentStep: number
  ): Promise<{
    score: number;
    feedback: string;
    nextStep?: {
      step: number;
      title: string;
      instruction: string;
    };
  }> {
    // 해당 세션의 가이드라인 조회
    const drawingGuide = await this.drawingGuideModel.findOne({
      sessionId,
      topic
    }).exec();

    if (!drawingGuide) {
      this.logger.error('가이드라인을 찾을 수 없습니다', { sessionId, topic });
      throw new Error('가이드라인을 찾을 수 없습니다');
    }

    // 그림 평가 수행
    const evaluation = await this.evaluateDrawing(
      userImageUrl,
      drawingGuide.imageUrl,
      currentStep
    );

    // 평가 결과 저장
    drawingGuide.evaluation = evaluation;
    await drawingGuide.save();

    this.logger.log(`
      그림 평가 완료:
      점수: ${evaluation.score}
      피드백: ${evaluation.feedback}
    `);

    // 통과 점수를 넘긴 경우 다음 단계 정보 제공
    if (evaluation.score >= this.PASS_SCORE && currentStep < 7) {
      const nextStep = {
        step: drawingGuide.steps[currentStep].step,
        title: drawingGuide.steps[currentStep].title,
        instruction: drawingGuide.steps[currentStep].instruction
      };
      return {
        ...evaluation,
        nextStep
      };
    }

    // 통과하지 못한 경우 현재 단계 유지
    return evaluation;
  }

  /**
   * 🎨 그림 평가하기
   */
  private async evaluateDrawing(
    userImageUrl: string,
    guideImageUrl: string,
    currentStep: number
  ): Promise<{ score: number; feedback: string }> {
    const evaluationPrompt = `
      가이드 이미지: ${guideImageUrl}
      사용자 이미지: ${userImageUrl}
      현재 단계: ${currentStep}/5

      위 두 이미지를 비교하여 사용자의 그림을 평가해주세요.
      
      중요한 규칙:
      1. 점수는 100점 만점 기준으로 평가
      2. 현재 진행 단계를 고려하여 평가 (초반 단계면 기본 형태 위주로, 후반 단계면 세부 묘사와 색감까지)
      3. 피드백은 다음과 같이 구성:
         - 80점 이상: 칭찬 위주의 피드백
         - 40-79점: 칭찬과 함께 보완점 제시
         - 40점 미만: 격려와 함께 구체적인 개선점 제시
      4. 피드백은 친근한 어투로 20단어 내외로 작성
      
      응답 형식:
      {
        "score": number,
        "feedback": string
      }
    `;

    const evaluationJson = await this.openAIService.generateText(evaluationPrompt);
    return JSON.parse(evaluationJson);
  }
} 