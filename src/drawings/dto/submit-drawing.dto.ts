import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, Max, IsUrl } from 'class-validator';

export class SubmitDrawingRequestDto {
  @ApiProperty({
    description: '세션 ID',
    example: 'abc123'
  })
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: '노인 이름',
    example: '김할머니'
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: '그림 주제',
    example: '참외'
  })
  @IsString()
  topic: string;

  @ApiProperty({
    description: '그리기 단계 (1: 기본 형태, 2: 세부 묘사)',
    example: 1
  })
  @IsNumber()
  @Min(1)
  @Max(2)
  phase: number;

  @ApiProperty({
    description: '이미지 URL (S3)',
    example: 'https://s3.example.com/drawings/abc123.jpg'
  })
  @IsUrl()
  imageData: string;
}

export class SubmitDrawingResponseDto {
  @ApiProperty({
    description: 'AI 평가 점수 (0-100)',
    example: 85
  })
  score: number;

  @ApiProperty({
    description: '통과 여부 (80점 이상)',
    example: true
  })
  passed: boolean;

  @ApiProperty({
    description: 'AI 피드백 음성 데이터 (MP3)',
    type: 'string',
    format: 'binary'
  })
  aiFeedbackWav: Buffer;
} 