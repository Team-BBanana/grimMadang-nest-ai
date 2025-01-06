import { Controller, Post, Body } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { WelcomeFlowRequestDto, WelcomeFlowResponseDto } from './dto/welcome-flow.dto';

@Controller('api/conversation')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
  ) {}

  @Post('welcomeFlow')
  async handleWelcomeFlow( @Body() welcomeFlowDto: WelcomeFlowRequestDto ): Promise<WelcomeFlowResponseDto> {
    // first 요청이면서 출석 데이터가 있는 경우
    if (
      welcomeFlowDto.userRequestWavWelcome === 'first' && 
      welcomeFlowDto.attendanceTotal !== 'null' && 
      welcomeFlowDto.attendance_streak !== 'null'
    ) {
      // 노인 기존 데이터가 있는 경우 대화 처리
      return this.conversationService.processFirstWelcomeWithAttendance(welcomeFlowDto);
    }
    
    // 노인 데이터가 없는 경우 대화 처리
    return this.conversationService.processWelcomeFlow(welcomeFlowDto);
  }



}