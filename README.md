# 🎨 그림마당 AI 서버

## 📋 프로젝트 개요
노인 사용자를 위한 AI 기반 대화형 그림 그리기 서비스의 백엔드 서버입니다.

## 🛠 기술 스택
- NestJS (Node.js 프레임워크)
- TypeScript 5.x
  - Target: ES2018 (ES9) - LTS
  - Module: CommonJS
- MongoDB
- OpenAI API (GPT-3.5-turbo, Whisper, TTS)
- Swagger (API 문서화)

## 🚀 주요 기능
1. 대화 관리 (ConversationService)
   - 음성-텍스트 변환 (STT)
   - 자연어 처리 및 응답 생성
   - 텍스트-음성 변환 (TTS)
   - 대화 이력 저장 및 관리
   - 개인화된 대화 (사용자 이름 활용)

2. 사용자 데이터 관리
   - 기본 정보 (이름, 세션ID)
   - 출석 데이터 (총 출석일수, 연속 출석일수)
   - 관심사 및 선호도 추적
   - 개인 상태 정보 저장

3. 대화 분석 및 정보 추출
   - 사용자 관심사 자동 추출
   - 그림 관련 선호도 파악
     - 난이도 선호도
     - 스타일 선호도
     - 선호 주제/색상
   - 개인 상태 정보 수집
     - 감정 상태
     - 신체 상태
     - 그림 그리기 경험

## 💾 데이터 구조
### Conversation 스키마
```typescript
{
  sessionId: string;       // 세션 식별자
  name: string;           // 사용자 이름
  userText: string;       // 사용자 입력
  aiResponse: string;     // AI 응답
  isFirstVisit: boolean;  // 첫 방문 여부
  attendanceTotal?: string;    // 총 출석일
  attendanceStreak?: string;   // 연속 출석일
  conversationOrder: number;   // 대화 순서
  interests: string[];         // 관심사 목록
  preferences: {              // 선호도 정보
    difficulty?: string;      // 선호 난이도
    style?: string;          // 선호 스타일
    subjects?: string[];     // 선호 주제
    colors?: string[];       // 선호 색상
  };
  personalInfo: {            // 개인 상태 정보
    mood?: string;          // 감정 상태
    physicalCondition?: string;  // 신체 상태
    experience?: string;    // 그림 경험
  };
}
```

## 💻 개발 환경 설정
1. 필수 요구사항
   ```bash
   Node.js >= 18.x
   MongoDB >= 7.x
   ```

2. 환경변수 설정
   ```bash
   # .env 파일 생성
   OPENAI_API_KEY=your_api_key
   MONGODB_URI=mongodb://127.0.0.1:27017/grimMadang
   ```

3. 설치 및 실행
   ```bash
   # 패키지 설치
   npm install

   # 개발 모드 실행
   npm run start:dev

   # 프로덕션 모드 실행
   npm run start:prod
   ```

## 📝 API 문서
- Swagger UI: `http://localhost:3000/api-docs`

### 주요 엔드포인트
1. 웰컴 플로우 (`POST /api/conversation/welcomeFlow`)
   ```typescript
   // 요청 본문
   {
     sessionId: string;          // 세션 ID
     name: string;              // 사용자 이름
     userRequestWavWelcome: string | 'first';  // 음성 데이터 또는 'first'
     attendanceTotal: string;    // 총 출석일
     attendanceStreak: string;   // 연속 출석일
   }

   // 응답 본문
   {
     statusCode: number;        // HTTP 상태 코드
     message: string;          // 응답 메시지
     data: {
       aiResponseWayWelcome: string;  // 음성 응답 (base64)
       choice: boolean;              // 그림 그리기 의향
     }
     timestamp: string;        // 응답 시간
   }
   ```

## 🔄 응답 형식
모든 API 응답은 다음 형식을 따릅니다:
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    // 실제 응답 데이터
  },
  "timestamp": "2025-01-06T11:30:00.000Z"
}
```