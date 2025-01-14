import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as zlib from 'zlib';
import { File } from '@web-std/file';

// API 응답 타입 정의
interface GoogleSpeechResponse {
  results: {
    alternatives: {
      transcript: string;    // 변환된 텍스트
      confidence: number;    // 변환 정확도
    }[];
  }[];
}

interface GoogleTTSResponse {
  audioContent: string;    // base64로 인코딩된 오디오 데이터
}

@Injectable()
export class GoogleSpeechService {
  private readonly logger = new Logger(GoogleSpeechService.name);
  private readonly apiKey: string;
  private readonly sttBaseUrl = 'https://speech.googleapis.com/v1/speech:recognize';
  private readonly ttsBaseUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize';

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY;
    if (!this.apiKey) {
      throw new Error('Google API Key is not configured');
    }
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.apiKey
    };
  }

  // 🎤 음성을 텍스트로 변환하는 함수 (Speech-to-Text)
  async speechToText(audioData: Buffer): Promise<string> {
    try {
      this.logger.debug('Converting speech to text');
      
      const requestBody = {
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'ko-KR',
          model: 'default',
          useEnhanced: true,
        },
        audio: {
          content: audioData.toString('base64'),
        },
      };

      const response = await axios.post<GoogleSpeechResponse>(
        `${this.sttBaseUrl}?key=${this.apiKey}`,
        requestBody,
        { headers: { 'Content-Type': 'application/json' } }
      );

      return response.data.results
        ?.map(result => result.alternatives[0]?.transcript)
        .join('\n') || '';

    } catch (error) {
      this.logger.error(`Error in speechToText: ${error.message}`);
      throw error;
    }
  }

  // 🔊 텍스트를 음성으로 변환하는 함수 (Text-to-Speech)
  async textToSpeech(text: string): Promise<Buffer> {
    try {
      this.logger.debug('Converting text to speech:', text);
      
      const requestBody = {
        input: { text },
        voice: {
          languageCode: 'ko-KR',
          name: 'ko-KR-Standard-A',
          ssmlGender: 'FEMALE'
        },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          pitch: 0,
          speakingRate: 1,
          volumeGainDb: 0,
          effectsProfileId: ['small-bluetooth-speaker-class-device']
        },
      };

      const response = await axios.post<GoogleTTSResponse>(
        `${this.ttsBaseUrl}?key=${this.apiKey}`,
        requestBody,
        { headers: { 'Content-Type': 'application/json' } }
      );

      return Buffer.from(response.data.audioContent, 'base64');

    } catch (error) {
      this.logger.error(`Error in textToSpeech: ${error.message}`);
      throw error;
    }
  }
}