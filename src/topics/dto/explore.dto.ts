import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

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
    description: '사용자의 음성 데이터 (첫 호출시: "first", 이후: base64로 인코딩된 WAV)',
    example: 'first'
  })
  @IsString()
  @IsNotEmpty()
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
    description: 'AI 음성 응답 데이터 (base64로 인코딩된 WAV)',
    format: 'base64'
  })
  aiResponseExploreWav: string;
}

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