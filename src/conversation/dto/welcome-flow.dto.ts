// 스프링 서버에서 받아올 노인 데이터 인터페이스
export class WelcomeFlowRequestDto {
    sessionId: string;
    userRequestWavWelcome: string; // wav 바이너리 데이터 또는 "first"
    attendanceTotal: string | "null"; // n일 누적 출석
    attendance_streak: string | "null"; // n일 연속 출석
  }
  
  export class WelcomeFlowResponseDto {
    aiResponseWelcomeWav: string; // wav 바이너리 데이터
    choice: boolean; // 기본값 false, 그림 그리고 싶다는 언급 시 true
  }