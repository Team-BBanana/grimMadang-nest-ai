import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, Max } from 'class-validator';

export class SubmitDrawingRequestDto {
  @ApiProperty({
    description: '세션 ID',
    example: 'abc123'
  })
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: '그림 주제',
    example: '바나나'
  })
  @IsString()
  topic: string;

  @ApiProperty({
    description: '사용자가 그린 그림의 이미지 URL',
    example: 'https://bbanana.s3.ap-northeast-2.amazonaws.com/canvas-image-step-1-8880922c-a73d-4818-a183-092d8d4bd2f4-MmMv5EdN.png'
  })
  @IsString()
  imageUrl: string;

  @ApiProperty({
    description: '현재 진행 단계 (1 ~ 5단계 사이)',
    example: 1,
    minimum: 1,
    maximum: 5
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  currentStep: number;
}

export class SubmitDrawingResponseDto {
  @ApiProperty({
    description: '평가 점수 (0-100)',
    example: 85
  })
  score: number;

  @ApiProperty({
    description: '평가 피드백',
    example: '기본 형태를 잘 잡았어요! 다음 단계로 넘어가볼까요?'
  })
  feedback: string;

  @ApiProperty({
    description: '통과 여부 (40점 이상)',
    example: true
  })
  passed: boolean;

  @ApiProperty({
    description: '다음 단계 정보 (통과한 경우에만 제공)',
    required: false
  })
  nextStep?: {
    step: number;
    title: string;
    instruction: string;
  };
} 