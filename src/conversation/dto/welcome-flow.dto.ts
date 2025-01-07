import { ApiProperty } from '@nestjs/swagger';

// 🎯 스프링 서버에서 받아올 노인 데이터 인터페이스 - 웰컴 플로우 요청 DTO
export class WelcomeFlowRequestDto {
    @ApiProperty({
      description: '사용자 세션을 구분하기 위한 고유 식별자',
      example: 'abc123'
    })
    sessionId: string;
    
    @ApiProperty({
      description: '노인 사용자의 이름',
      example: '김영희'
    })
    name: string;
    
    @ApiProperty({
      description: '사용자의 음성 데이터 (첫 대화시: "first", 이후: WAV 바이너리)',
      example: 'first'
    })
    userRequestWavWelcome: string | 'first';
    
    @ApiProperty({
      description: '사용자의 총 출석 일수',
      example: '10'
    })
    attendanceTotal: string;
    
    @ApiProperty({
      description: '사용자의 연속 출석 일수',
      example: '5'
    })
    attendanceStreak: string;
}

// 🤖 AI가 생성한 응답을 전달하기 위한 웰컴 플로우 응답 DTO
export class WelcomeFlowResponseDto {
    @ApiProperty({
    //   description: 'AI가 생성한 음성 응답 데이터 (WAV 바이너리)',
      description: 'AI가 생성한 음성 응답 데이터 (WAV 바이너리를 base64로 인코딩)',
      type: 'string',
    //   format: 'binary'
      format: 'base64'
    })
    // aiResponseWelcomeWav: Buffer;
    aiResponseWelcomeWav: string;
    
    @ApiProperty({
      description: '그림 그리기 활동 선호도 표시',
      example: false
    })
    choice: boolean;
}