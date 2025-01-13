import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

// Google STT API 응답 타입 정의
interface GoogleSpeechResponse {
  results: {
    alternatives: {
      transcript: string;
      confidence: number;
    }[];
  }[];
}

// Google STT API 서비스 클래스
@Injectable()
export class GoogleSpeechService {
  private readonly logger = new Logger(GoogleSpeechService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://speech.googleapis.com/v1/speech:recognize';

  // 생성자 - Google API 키 설정
  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY;
    if (!this.apiKey) {
      throw new Error('Google API Key is not configured');
    }
  }

  // 음성 텍스트 변환 메서드
  async speechToText(audioBuffer: Buffer): Promise<string> {
    try {
      // 요청 본문 생성
      const requestBody = {
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'ko-KR',
        },
        audio: {
          content: audioBuffer.toString('base64'),
        },
      };

      // Google STT API 호출
      const response = await axios.post<GoogleSpeechResponse>(
        `${this.baseUrl}?key=${this.apiKey}`,
        requestBody
      );

      // 텍스트 추출
      const transcription = response.data.results
        ?.map(result => result.alternatives[0]?.transcript)
        .join('\n');

      this.logger.debug('Speech to text conversion successful');
      return transcription || '';
    
      // 오류 처리
    } catch (error) {
      this.logger.error(`Error in speechToText: ${error.message}`);
      throw error;
    }
  }
}