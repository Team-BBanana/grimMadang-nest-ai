// 🔧 NestJS에서 필요한 데코레이터와 타입들을 가져오는 import
import { Controller, Post, Body, Logger, UseInterceptors, HttpStatus } from '@nestjs/common';
// 💼 대화 관련 비즈니스 로직을 처리하는 서비스 클래스 import
import { ConversationService } from './conversation.service';
// 📝 웰컴 플로우 관련 DTO(Data Transfer Object) 타입 정의 import
import { WelcomeFlowRequestDto, WelcomeFlowResponseDto } from './dto/welcome-flow.dto';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';

// 🎯 '/api/conversation' 경로로 들어오는 요청을 처리하는 컨트롤러
@Controller('api/conversation')
@UseInterceptors(TransformInterceptor)
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  // 🔨 의존성 주입을 통해 ConversationService 인스턴스 주입
  constructor(
    private readonly conversationService: ConversationService,
  ) { }

  // 🚀 '/welcomeFlow' POST 요청을 처리하는 엔드포인트
  @Post('welcomeFlow')
  @ApiOperation({ summary: '웰컴 플로우 대화 처리' })
  @SwaggerResponse({
    status: HttpStatus.OK,
    description: '대화 처리 성공',
    type: WelcomeFlowResponseDto
  })
  async handleWelcomeFlow(
    @Body() welcomeFlowDto: WelcomeFlowRequestDto
  ): Promise<WelcomeFlowResponseDto> {
    this.logger.log(`Received welcomeFlow request for session: ${welcomeFlowDto.sessionId}`);
    this.logger.debug('Request payload:', welcomeFlowDto);

    try {
      const response = await this.conversationService.processWelcomeFlow(welcomeFlowDto);
      // 로깅
      this.logger.log(`Successfully processed welcomeFlow for session: ${welcomeFlowDto.sessionId}`);
      return response;
    } catch (error) {
      this.logger.error(`Error processing welcomeFlow: ${error.message}`, error.stack);
      throw error;
    }
  }
}