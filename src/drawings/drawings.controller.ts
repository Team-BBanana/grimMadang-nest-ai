import { Controller, Post, Body, Logger, UseInterceptors } from '@nestjs/common';
import { DrawingsService } from './drawings.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

@ApiTags('Drawings')
@Controller('api/drawings')
@UseInterceptors(TransformInterceptor)
export class DrawingsController {
  private readonly logger = new Logger(DrawingsController.name);

  constructor(private readonly drawingsService: DrawingsService) {}

  // 추후 엔드포인트들이 여기에 추가될 예정
} 