// 🔧 NestJS에서 필요한 데코레이터와 타입들을 가져오는 import
import { Controller, Post, Body } from '@nestjs/common';
// 💼 대화 관련 비즈니스 로직을 처리하는 서비스 클래스 import
import { ConversationService } from './conversation.service';
// 📝 웰컴 플로우 관련 DTO(Data Transfer Object) 타입 정의 import
import { WelcomeFlowRequestDto, WelcomeFlowResponseDto } from './dto/welcome-flow.dto';

// 🎯 '/api/conversation' 경로로 들어오는 요청을 처리하는 컨트롤러
@Controller('api/conversation')
export class ConversationController {
  // 🔨 의존성 주입을 통해 ConversationService 인스턴스 주입
  constructor(
    private readonly conversationService: ConversationService,
  ) {}

  // 🚀 '/welcomeFlow' POST 요청을 처리하는 엔드포인트
  @Post('welcomeFlow')
  async handleWelcomeFlow( @Body() welcomeFlowDto: WelcomeFlowRequestDto ): Promise<WelcomeFlowResponseDto> {
    // 👋 사용자의 첫 방문인 경우 출석 체크와 함께 환영 메시지 처리
    if (welcomeFlowDto.userRequestWavWelcome === 'first') {
      return this.conversationService.processFirstWelcomeWithAttendance(welcomeFlowDto);
    }
    
    // 💬 일반적인 대화 요청 처리
    return this.conversationService.processWelcomeFlow(welcomeFlowDto);
  }
}