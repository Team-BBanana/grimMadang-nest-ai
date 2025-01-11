# 🎨 그림마당 AI 서버

## 📋 프로젝트 개요
노인 사용자를 위한 AI 기반 대화형 그림 그리기 서비스의 백엔드 서버입니다.

## 🛠 최근 업데이트

### 1. 그림 평가 기능 (2025.01.11)
- **기능 개요**
  - AI 기반 그림 분석 및 점수 산정
  - 단계별 평가 (기본 형태 → 세부 묘사)
  - 음성 피드백 제공

- **평가 프로세스**
  - 1단계: 기본 형태 평가 (선, 모양, 비율)
  - 2단계: 세부 특징 평가 (색감, 질감, 디테일)

- **주요 기능**
  - GPT-4 Vision 기반 이미지 분석
  - 100점 만점 평가 (통과: 80점)
  - 음성 피드백 생성
  - 단계별 학습 지원

### 2. AWS S3 통합 (2025.01.11)
- **이미지 저장소 구현**
  - S3 업로드/다운로드 기능
  - URL-이미지 자동 처리
  - 보안 자격 증명 관리

- **DALL-E 연동 개선**
  - 생성 이미지 자동 저장
  - 영구 스토리지 활용
  - 안정적 이미지 제공

### 3. 음성 데이터 처리 개선 (2025.01.11)
- **데이터 최적화**
  - GZIP 압축 적용
  - base64 인코딩 제거
  - 바이너리 직접 전송

- **응답 포맷 개선**
  - MP3 형식 사용
  - 음성 속도 조절
  - 압축 버퍼 전송

### 4. 주제 추천 서비스 개선 (2025.01.10)
- **메타데이터 처리**
  - Spring 서버 연동
  - 조회-생성-저장 프로세스
  - API 최적화

- **응답 구조 개선**
  - 메타데이터 통합
  - 음성 응답 포함
  - 상태 정보 관리

## 🚀 핵심 기능

### 1. 대화 관리 (ConversationService)
- 음성-텍스트 변환 (STT)
- 자연어 처리 및 응답
- 텍스트-음성 변환 (TTS)
- 대화 이력 관리
- 개인화 대화

### 2. 사용자 데이터 관리 
- 기본 정보 관리
- 출석 데이터 추적
- 관심사 분석
- 상태 정보 저장

### 3. 주제 추천 (TopicsService)
- 관심사 기반 추천
- 동적 주제 그룹
- 그리기 가이드라인
- DALL-E 이미지 생성
- 메타데이터 관리

### 4. 그림 평가 (DrawingsService)
- AI 이미지 분석
- 단계별 평가
- 음성 피드백
- 학습 진행 관리

## 🛠 기술 스택
- NestJS (Node.js)
- TypeScript 5.x
- MongoDB
- OpenAI API
  - GPT-3.5-turbo
  - GPT-4 Vision
  - Whisper
  - TTS
  - DALL-E
- AWS S3
- Spring Boot 연동
- Swagger

## 📡 API 엔드포인트

### 1. 그림 평가
```http
POST /api/drawings/submit
```
- **요청**: sessionId, name, topic, phase, imageData
- **응답**: score, passed, aiFeedbackWav

### 2. 웰컴 플로우
```http
POST /api/conversation/welcomeFlow
```
- **요청**: sessionId, name, userRequestWelcomeWav, attendanceData
- **응답**: aiResponseWayWelcome, choice

### 3. 주제 추천
```http
POST /api/topics/explore
```
- **요청**: sessionId, name, userRequestExploreWav, metadata
- **응답**: topics, select, aiResponseExploreWav

## 💻 개발 환경 설정

### 1. 요구사항
```bash
Node.js >= 18.x
MongoDB >= 7.x
```

### 2. 환경변수
```bash
OPENAI_API_KEY=your_api_key
MONGODB_URI=mongodb://localhost:27017/grimMadang
SPRING_API_URL=http://localhost:8080
AWS_ACCESS_KEY=your_aws_key
AWS_SECRET_KEY=your_aws_secret
```

### 3. 설치 및 실행
```bash
# 설치
npm install

# 개발 실행
npm run start:dev

# 배포 실행
npm run start:prod
```

## 📚 API 문서
- Swagger UI: `http://localhost:3000/api-docs`
- 표준 응답 형식:
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "timestamp": "2025-01-11T00:00:00.000Z"
}
```