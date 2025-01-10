import { Controller, Post, Body, Logger } from '@nestjs/common';
import { TopicsService } from './topics.service';
import { ExploreTopicsRequestDto, ExploreTopicsResponseDto } from './dto/explore.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Topics')
@Controller('/topics')
export class TopicsController {
  private readonly logger = new Logger('주제 추천 컨트롤러');

  constructor(private readonly topicsService: TopicsService) {}

  // 🎨 주제 추천 API
  @Post('explore')
  @ApiOperation({ 
    summary: '주제 추천', 
    description: '사용자의 대화 데이터를 기반으로 그림 그리기 주제를 추천합니다.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '추천된 주제 목록 또는 선택된 주제', 
    type: ExploreTopicsResponseDto 
  })
  async exploreTopics(@Body() dto: ExploreTopicsRequestDto): Promise<ExploreTopicsResponseDto> {
    this.logger.log(`Received explore topics request for user: ${dto.name} (${dto.sessionId})`);
    return this.topicsService.exploreTopics(dto);
  }
} 