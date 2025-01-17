import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DrawingsService } from './drawings.service';
import { SubmitDrawingRequestDto, SubmitDrawingResponseDto } from './dto/submit-drawing.dto';

@ApiTags('drawings')
@Controller('api/drawings')
export class DrawingsController {
  private readonly logger = new Logger(DrawingsController.name);

  constructor(private readonly drawingsService: DrawingsService) {}

  @Post('/submit')
  @ApiOperation({ 
    summary: '그림 제출 및 AI 평가',
    description: `
    사용자가 그림을 제출하면 AI가 그림을 분석하여 점수를 산정하고 피드백을 제공합니다.
    통과 점수(40점) 이상인 경우 다음 단계 정보도 함께 제공됩니다.
    `
  })
  @ApiResponse({
    status: 200,
    description: 'AI 평가 결과',
    type: SubmitDrawingResponseDto
  })
  async submitDrawing(@Body() request: SubmitDrawingRequestDto): Promise<SubmitDrawingResponseDto> {
    this.logger.debug(`그림 제출 요청 - 세션: ${request.sessionId}, 주제: ${request.topic}, 단계: ${request.currentStep}`);
    this.logger.debug('imageUrl:', request.imageUrl);
    const evaluation = await this.drawingsService.submitDrawing(
      request.sessionId,
      request.topic,
      request.imageUrl,
      request.currentStep
    );

    return {
      score: evaluation.score,
      feedback: evaluation.feedback,
      nextStep: evaluation.nextStep,
      passed: evaluation.score >= 40
    };
  }
}