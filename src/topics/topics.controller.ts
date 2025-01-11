import { Controller, Post, Body, Logger } from '@nestjs/common';
import { TopicsService } from './topics.service';
import { ExploreTopicsRequestDto, ExploreTopicsResponseDto } from './dto/explore.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Topics')
@Controller('api/topics')
export class TopicsController {
  private readonly logger = new Logger('주제 추천 컨트롤러');

  constructor(private readonly topicsService: TopicsService) {}

  // 🎨 주제 추천 API
  @Post('/explore')
  @ApiOperation({ 
    summary: '주제 추천', 
    description: `
    사용자의 대화 데이터를 기반으로 그림 그리기 주제를 추천합니다.
    
    - 첫 방문 시: 사용자의 관심사를 분석하여 적절한 주제를 추천
    - 주제 선택 시: 선택한 주제에 대한 확인 메시지 제공
    - 주제 확정 시: 그리기 가이드라인과 함께 확정 메시지 제공
    - 다른 주제 요청 시: 새로운 주제 그룹에서 주제 추천
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: '추천된 주제 목록 또는 선택된 주제와 AI 음성 응답', 
    type: ExploreTopicsResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: '잘못된 요청 (요청 데이터 형식 오류)' 
  })
  @ApiResponse({ 
    status: 500, 
    description: '서버 오류 (AI 서비스 연동 실패 등)' 
  })
  async exploreTopics(@Body() dto: ExploreTopicsRequestDto): Promise<ExploreTopicsResponseDto> {
    this.logger.log(`Received explore topics request for user: ${dto.name} (${dto.sessionId})`);
    return this.topicsService.exploreTopics(dto);
  }
} 