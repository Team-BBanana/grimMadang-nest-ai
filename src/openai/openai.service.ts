// 🤖 OpenAI API를 사용하기 위한 필수 모듈 임포트
import { Injectable } from '@nestjs/common';
import { OpenAIConfig } from '../config/openai.config';
import OpenAI from 'openai';
import { File } from '@web-std/file';

// 🔌 OpenAI 서비스 클래스 - OpenAI API와의 모든 상호작용을 관리
@Injectable()
export class OpenAIService {
  // OpenAI 인스턴스를 저장하는 private 변수
  private readonly openai: OpenAI;

  // ⚡ OpenAIConfig를 주입받아 OpenAI 인스턴스 초기화
  constructor(private readonly openaiConfig: OpenAIConfig) {
    this.openai = this.openaiConfig.getOpenAI();
  }

  // 🎤 음성을 텍스트로 변환하는 함수 (Speech-to-Text)
  async speechToText(audioData: Buffer): Promise<string> {
    // 받은 오디오 데이터를 File 객체로 변환
    const file = new File([audioData], 'audio.wav', { type: 'audio/wav' });
    // Whisper 모델을 사용하여 음성을 텍스트로 변환
    const transcription = await this.openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });

    return transcription.text;
  }

  // 💭 텍스트 생성 함수 - GPT 모델을 사용하여 대화형 텍스트 생성
  async generateText(prompt: string): Promise<string> {
    // GPT-3.5-turbo 모델을 사용하여 텍스트 생성
    const completion = await this.openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-3.5-turbo',
    });

    // 생성된 응답 중 첫 번째 선택지의 내용을 반환
    return completion.choices[0].message.content;
  }

  // 🔊 텍스트를 음성으로 변환하는 함수 (Text-to-Speech)
  async textToSpeech(text: string): Promise<Buffer> {
    // TTS-1 모델과 Nova 음성을 사용하여 텍스트를 음성으로 변환
    const mp3 = await this.openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text,
    });

    // 생성된 음성을 Buffer로 변환하여 반환
    const buffer = Buffer.from(await mp3.arrayBuffer());
    return buffer;
  }
} 