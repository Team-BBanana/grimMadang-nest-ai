# 그림마당 AI 서버

노인 사용자를 대상으로 한 AI 기반 대화 및 그림 그리기 애플리케이션의 백엔드 서버

## 기술 스택

- NestJS
- OpenAI API (STT, Text Generation, TTS)

## 주요 기능

1. 첫 접속 및 인사 (3분 대화)
   - 사용자 첫 접속 시 환영 인사
   - 3분간 자연스러운 대화를 통한 사용자 상태 파악
   - 대화 내용 기반 맞춤형 주제 추천

2. 주제 추천 및 선택
   - 사용자 수준에 맞는 그림 주제 추천
   - 주제 그룹별 추천 및 변경 기능
   - 선택된 주제에 대한 상세 설명 제공

3. 그림판 전환
   - 선택된 주제에 대한 예시 이미지 및 설명 제공
   - 그림 그리기 인터페이스로 자동 전환

4. 그림 제출 및 AI 평가
   - 제출된 그림에 대한 AI 평가
   - 점수 산정 및 피드백 제공
   - 재도전 기회 제공

## API 엔드포인트

| 기능 | 엔드포인트 | 설명 |
| --- | --- | --- |
| 자연스러운 대화 시작 | `POST /api/conversation/welcomeFlow` | 3분간의 자연스러운 대화를 시작 |
| 주제 추천 / 선택 | `POST /api/topics/explore` | 사용자가 쉽게 그릴 수 있는 주제를 추천 |
| 이미지 및 설명 데이터 요청 | `POST /api/image/metadata` | 주제에 맞는 이미지 및 설명을 반환 |
| 그림 제출 및 피드백 | `POST /api/drawings/submit` | 그림 제출 및 AI 평가 피드백 제공 |

## 프로젝트 구조

```
src/
├── conversation/         # 대화 관련 모듈
│   ├── dto/             # 데이터 전송 객체
│   ├── conversation.controller.ts
│   ├── conversation.service.ts
│   └── conversation.module.ts
└── app.module.ts        # 루트 모듈
```

## 설치 및 실행

```bash
# 패키지 설치
npm install

# 개발 모드로 실행
npm run start:dev

# 프로덕션 모드로 실행
npm run start:prod
```

## 환경 변수

- `PORT`: 서버 포트 (기본값: 3000)
- `OPENAI_API_KEY`: OpenAI API 키

## 데이터 흐름

1. 클라이언트에서 음성 데이터(WAV) 전송
2. 서버에서 OpenAI STT로 텍스트 변환
3. 텍스트 기반 AI 응답 생성
4. OpenAI TTS로 음성 응답 생성
5. 클라이언트로 음성 데이터 반환