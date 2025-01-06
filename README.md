# 🎨 그림마당 AI 서버

## 📋 프로젝트 개요
노인 사용자를 위한 AI 기반 대화형 그림 그리기 서비스의 백엔드 서버입니다.

## 🛠 기술 스택
- NestJS (Node.js 프레임워크)
- TypeScript (ES2021)
- MongoDB
- OpenAI API (GPT-4, Whisper, TTS)
- Swagger (API 문서화)

## 🚀 주요 기능
1. 대화 관리 (ConversationService)
   - 음성-텍스트 변환 (STT)
   - 자연어 처리 및 응답 생성
   - 텍스트-음성 변환 (TTS)
   - 대화 이력 저장 및 관리

2. 출석 데이터 활용
   - 총 출석일수 및 연속 출석일수 기반 맞춤형 응답
   - 첫 방문 사용자 구분 및 특별 환영 메시지

3. 그림 그리기 의향 분석
   - AI 기반 사용자 의도 파악
   - 맥락 기반 자연스러운 대화 유도

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
   - 사용자 세션 관리
   - 음성/텍스트 기반 대화 처리
   - 출석 데이터 기반 맞춤형 응답

## 🗃 프로젝트 구조
```
src/
├── conversation/           # 대화 관리 모듈
│   ├── dto/               # 데이터 전송 객체
│   ├── schemas/           # MongoDB 스키마
│   ├── conversation.controller.ts
│   ├── conversation.service.ts
│   └── conversation.module.ts
├── openai/                # OpenAI 통합 모듈
│   ├── openai.config.ts
│   ├── openai.service.ts
│   └── openai.module.ts
└── common/                # 공통 유틸리티
    ├── interceptors/      # 응답 변환 인터셉터
    └── interfaces/        # 공통 인터페이스
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