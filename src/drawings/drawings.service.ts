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
    passed: boolean;
  }> {
    this.logger.debug(`그림 제출 - 세션: ${sessionId}, 주제: ${topic}, 현재 단계: ${currentStep}`);

    // 해당 세션의 가이드라인 조회
    const drawingGuide = await this.drawingGuideModel.findOne({
      sessionId,
      topic
    }).exec();

    if (!drawingGuide) {
      this.logger.error('가이드라인을 찾을 수 없습니다', { sessionId, topic });
      throw new Error('가이드라인을 찾을 수 없습니다');
    }

    this.logger.debug('가이드라인 단계들:', drawingGuide.steps);

    // 현재 단계가 유효한지 확인
    if (currentStep < 1 || currentStep > drawingGuide.steps.length) {
      this.logger.error('유효하지 않은 단계:', { currentStep, totalSteps: drawingGuide.steps.length });
      throw new Error('유효하지 않은 단계입니다');
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
      현재 단계: ${currentStep}
      통과 여부: ${evaluation.score >= this.PASS_SCORE}
    `);

    // 통과 점수를 넘긴 경우에만 다음 단계 정보 제공
    if (evaluation.score >= this.PASS_SCORE && currentStep < drawingGuide.steps.length) {
      // 다음 단계는 현재 단계 + 1
      const nextStep = currentStep + 1;
      const nextStepData = drawingGuide.steps.find(s => s.step === nextStep);
      
      if (!nextStepData) {
        this.logger.error(`다음 단계 데이터를 찾을 수 없습니다: ${nextStep}`);
        return {
          score: evaluation.score,
          feedback: evaluation.feedback,
          passed: false
        };
      }
      
      this.logger.debug(`단계 전환 - 현재: ${currentStep}, 다음: ${nextStep}`);
      
      return {
        score: evaluation.score,
        feedback: evaluation.feedback,
        passed: true,
        nextStep: {
          step: nextStep,
          title: nextStepData.title,
          instruction: nextStepData.instruction
        }
      };
    }

    // 통과하지 못한 경우 현재 단계 유지
    return {
      score: evaluation.score,
      feedback: evaluation.feedback,
      passed: false
    };
  }

  /**
   * 🎨 그림 평가하기
   */
  private async evaluateDrawing(
    userImageUrl: string,
    guideImageUrl: string,
    currentStep: number
  ): Promise<{ score: number; feedback: string }> {
    // 현재 단계의 가이드라인 조회
    const drawingGuide = await this.drawingGuideModel.findOne({
      'steps.step': currentStep
    }).exec();

    if (!drawingGuide) {
      throw new Error(`단계 ${currentStep}에 대한 가이드라인을 찾을 수 없습니다`);
    }

    const currentStepGuide = drawingGuide.steps.find(s => s.step === currentStep);
    
    const systemPrompt = `
      당신은 노인 대상 심리치료사입니다. 
      그림 평가시 다음 규칙을 반드시 따라주세요:

      1. 이미지 비교 분석 기준:
         - 기준 이미지와 사용자 이미지를 다음 항목별로 비교
           a) 전체적인 형태와 비율 (크기, 위치, 균형)
           b) 주요 특징 (예: 사과의 꼭지, 잎사귀)
           c) 선의 품질 (굵기, 연결성, 깔끔함)
           d) 색상 사용 (색의 선택, 채도, 명도)
         - 각 항목에서 부족한 점을 구체적으로 파악
         - 기준 이미지와 비교하여 개선이 필요한 부분 명시

      2. 점수 산정 (100점 만점):
         - 현재 단계 지시사항 달성도: ${this.PASS_SCORE}점
          • "${currentStepGuide.instruction}"에 명시된 요구사항 기준
          • 지시사항의 각 요소별로 기준 이미지와 비교하여 평가

         * 주의: 현재 단계의 지시사항을 가장 중요한 평가 기준으로 삼을 것
         * 이전 단계에서 요구된 사항은 기본 요소 평가에 반영

      3. 피드백 작성:
         - ${this.PASS_SCORE}점 이상: "잘 하셨어요"로 시작하여 잘된 점과 개선점 모두 언급
         - ${this.PASS_SCORE}점 미만: "이렇게 해보시면 어떨까요?"로 시작하여 구체적인 개선 방법 제시
         - 반드시 기준 이미지와 비교하여 설명
         - 존댓말 사용 ("~하세요", "~이에요")
         - 구체적인 예시 포함 ("선이 반듯해요", "색칠이 꼼꼼해요")
         - 감정을 표현하는 형용사 사용 ("멋져요", "훌륭해요", "아름다워요")
         - 20단어 내외로 작성

      4. 응답은 반드시 아래 JSON 형식으로 작성:
         {
           "score": number,
           "feedback": string
         }
    `;

    const userPrompt = `
      환자가 그린 그림을 평가해주세요.

      현재 단계 정보:
      목표: ${currentStepGuide.title}
      지시사항: ${currentStepGuide.instruction}

      첫번째 이미지는 가이드 이미지이고,
      두번째 이미지는 환자가 그린 그림입니다.
      
      현재 단계의 지시사항을 기준으로 평가해주세요.
    `;

    return await this.openAIService.analyzeImagesWithVision(
      userImageUrl,
      guideImageUrl,
      currentStep,
      systemPrompt,
      userPrompt
    );
  }

  
} 