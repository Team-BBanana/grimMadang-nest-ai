// 🎯 스프링 서버에서 받아올 노인 데이터 인터페이스 - 웰컴 플로우 요청 DTO
export class WelcomeFlowRequestDto {
    // 🔑 사용자 세션을 구분하기 위한 고유 식별자
    sessionId: string;
    
    // 🎤 사용자의 음성 데이터
    // - 첫 대화시: 'first' 문자열
    // - 이후 대화: WAV 형식의 바이너리 음성 데이터
    userRequestWavWelcome: string | 'first';
    
    // 📅 사용자의 총 출석 일수를 나타내는 문자열 (예: "10일")
    attendanceTotal: string;
    
    // 🔥 사용자의 연속 출석 일수를 나타내는 문자열 (예: "5일")
    attendanceStreak: string;
}

// 🤖 AI가 생성한 응답을 전달하기 위한 웰컴 플로우 응답 DTO
export class WelcomeFlowResponseDto {
    // 🔊 AI가 생성한 음성 응답 데이터 (WAV 형식의 바이너리)
    aiResponseWelcomeWav: Buffer;
    
    // ✨ 그림 그리기 활동 선호도 표시
    // - false: 기본값, 그림 그리기 언급 없음
    // - true: 사용자가 그림 그리기 활동에 관심 표현
    choice: boolean;
}