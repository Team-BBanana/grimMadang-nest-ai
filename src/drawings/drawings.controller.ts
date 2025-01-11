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
  @ApiOperation({ summary: '그림 제출 및 AI 평가' })
  @ApiResponse({
    status: 200,
    description: 'AI 평가 결과',
    type: SubmitDrawingResponseDto
  })
  async submitDrawing(@Body() request: SubmitDrawingRequestDto): Promise<SubmitDrawingResponseDto> {
    this.logger.debug(`Received drawing submission for topic: ${request.topic}, phase: ${request.phase}`);
    return this.drawingsService.evaluateDrawing(request);
  }
} 