# 🎨 그림마당 AI 서버

## 📋 프로젝트 개요
노인 사용자를 위한 AI 기반 대화형 그림 그리기 서비스의 백엔드 서버입니다.

## 🛠 최근 업데이트

### 주제 추천 서비스 개선 (2024.01)
1. 메타데이터 처리 로직 개선
   - Spring 서버와의 연동 강화
   - 메타데이터 조회 → 없으면 생성 → 저장 순서로 처리
   - 불필요한 API 호출 최소화

2. 응답 구조 개선
   - 메타데이터(이미지 URL, 설명) 포함
   - 음성 응답 포함
   - 선택/확정 상태 정보 포함

3. AI 응답 생성 로직 개선
   - 상황별 맞춤형 프롬프트 사용
   - 사용자 친화적인 대화체 응답
   - 그리기 가이드라인 포함

4. 코드 구조 개선
   - 메서드 분리로 책임 명확화
   - 에러 처리 강화
   - 로깅 추가

## 🛠 기술 스택
- NestJS (Node.js 프레임워크)
- TypeScript 5.x
  - Target: ES2018 (ES9) - LTS
  - Module: CommonJS
- MongoDB
- OpenAI API (GPT-3.5-turbo, Whisper, TTS, DALL-E)
- Swagger (API 문서화)
- Spring Boot (연동)

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

4. 주제 추천 서비스 (TopicsService)
   - 사용자 관심사 기반 주제 추천
   - 동적 주제 그룹 생성
   - 상세 그리기 가이드라인 제공
   - 예시 이미지 생성 (DALL-E)
   - 메타데이터 관리 (Spring 서버 연동)
   - 주제 선택/확정 프로세스 관리

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

### Topic 스키마
```typescript
{
  name: string;           // 주제 이름 (예: 바나나, 사과 등)
  category: string;       // 카테고리 (예: 과일, 동물, 학용품 등)
  description?: string;   // 그리기 설명 또는 팁
  imageUrl?: string;      // 예시 이미지 URL
  isActive: boolean;      // 활성화 여부
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
   SPRING_API_URL=http://localhost:8080  # Spring 서버 URL
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

2. 주제 추천 (`POST /api/topics/explore`)
   ```typescript
   // 요청 본문
   {
     sessionId: string;          // 세션 ID
     name: string;              // 사용자 이름
     rejectedCount: number;     // 거절 횟수
     userRequestExploreWav: string | 'first';  // 음성 데이터 또는 'first'
     isTimedOut: string;        // 시간 초과 여부
   }

   // 응답 본문
   {
     statusCode: number;        // HTTP 상태 코드
     message: string;          // 응답 메시지
     data: {
       topics: string[] | string;  // 추천 주제 목록 또는 선택된 주제
       select: string;            // 주제 선택 완료 여부
       aiResponseExploreWav: string;  // 음성 응답 (base64)
       metadata?: {              // 선택된 주제의 메타데이터
         topicName: string;     // 주제 이름
         imageUrl: string;      // 예시 이미지 URL
         description: string;   // 그리기 가이드라인
       }
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