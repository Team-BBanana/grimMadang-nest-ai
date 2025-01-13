import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

// 🎯 주제 이미지 및 설명 생성 응답 DTO
export class TopicImageDescriptionResponseDto {
  @ApiProperty({
    description: '주제 이름',
    example: '참외'
  })
  topicName: string;

  @ApiProperty({
    description: '주제 이미지 URL',
    example: 'https://example.com/images/chamoe.jpg'
  })
  imageUrl: string;

  @ApiProperty({
    description: '주제 설명',
    example: '참외는 곡선을 살리는 게 포인트예요.'
  })
  description: string;
}

// 🎯 주제 추천 요청 DTO
export class ExploreTopicsRequestDto {
  @ApiProperty({
    description: '사용자 세션 ID',
    example: 'abc123'
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({
    description: '사용자 이름',
    example: '김할머니'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: '거절 횟수',
    example: 1
  })
  @IsNumber()
  rejectedCount: number;

  @ApiProperty({
    description: '사용자의 음성 데이터 (첫 호출시: "first", 이후: Buffer 또는 텍스트)',
    example: 'first',
    type: 'string',
    format: 'binary'
  })
  userRequestExploreWav: string;

  @ApiProperty({
    description: '시간 초과 여부',
    example: 'true'
  })
  @IsString()
  @IsNotEmpty()
  isTimedOut: string;
}

// 🎨 주제 추천 응답 DTO
export class ExploreTopicsResponseDto {
  @ApiProperty({
    description: '추천된 주제 목록 또는 선택된 주제 (배열: 추천 단계, 문자열: 선택 완료)',
    example: ['바나나', '사과', '배'] // 또는 '참외'
  })
  topics: string[] | string;

  @ApiProperty({
    description: '주제 선택 완료 여부',
    example: 'false'
  })
  select: string;

  @ApiProperty({
    description: 'AI 음성 응답 데이터 (압축된 MP3 바이너리)',
    type: 'string',
    format: 'binary'
  })
  aiResponseExploreWav: Buffer;

  @ApiProperty({
    description: 'AI 응답의 원본 텍스트',
    required: false
  })
  aiText?: string;

  @ApiProperty({
    description: '선택된 주제에 대한 메타데이터 (이미지 URL, 설명 등)',
    required: false,
    type: TopicImageDescriptionResponseDto
  })
  metadata?: TopicImageDescriptionResponseDto;

  @ApiProperty({ description: 'AI 응답의 원본 텍스트', required: false })
  originalText?: string;
} 