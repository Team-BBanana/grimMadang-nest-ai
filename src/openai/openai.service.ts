// 🤖 OpenAI API를 사용하기 위한 필수 모듈 임포트
import { Injectable, Logger } from '@nestjs/common';
import { OpenAIConfig } from '../config/openai.config';
import OpenAI from 'openai';
import { File } from '@web-std/file';

// 🔌 OpenAI 서비스 클래스 - OpenAI API와의 모든 상호작용을 관리
@Injectable()
export class OpenAIService {
  // OpenAI 인스턴스를 저장하는 private 변수
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;

  // ⚡ OpenAIConfig를 주입받아 OpenAI 인스턴스 초기화
  constructor(private readonly openaiConfig: OpenAIConfig) {
    this.openai = this.openaiConfig.getOpenAI();
  }

  // 🎤 음성을 텍스트로 변환하는 함수 (Speech-to-Text)
  async speechToText(audioData: Buffer): Promise<string> {
    try {
      this.logger.debug('Converting speech to text');
      // 받은 오디오 데이터를 File 객체로 변환
      const file = new File([audioData], 'audio.wav', { type: 'audio/wav' });
      // Whisper 모델을 사용하여 음성을 텍스트로 변환
      const transcription = await this.openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
      });

      this.logger.debug('Speech to text result:', transcription.text + '\n\n');
      return transcription.text;
    } catch (error) {
      this.logger.error(`Error in speechToText: ${error.message}`, error.stack);
      throw error;
    }
  }

  // 💭 텍스트 생성 함수 - GPT 모델을 사용하여 대화형 텍스트 생성
  async generateText(prompt: string): Promise<string> {
    try {
      this.logger.debug('Generating text with prompt:', prompt + '\n\n');
      // GPT-3.5-turbo 모델을 사용하여 텍스트 생성
      const completion = await this.openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-3.5-turbo',
      });

      const response = completion.choices[0].message.content;
      this.logger.debug('Generated text:', response + '\n\n');
      return response;
    } catch (error) {
      this.logger.error(`Error in generateText: ${error.message}`, error.stack);
      throw error;
    }
  }

  // 🔊 텍스트를 음성으로 변환하는 함수 (Text-to-Speech)
  async textToSpeech(text: string): Promise<Buffer> {
    try {
      this.logger.debug('Converting text to speech:', text);
      // TTS-1 모델과 Nova 음성을 사용하여 텍스트를 WAV 형식 음성으로 변환
      const audioResponse = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input: text,
        response_format: 'wav' // 🎵 WAV 형식으로 출력 지정
      });

      // 🔄 응답을 Buffer로 변환
      const buffer = Buffer.from(await audioResponse.arrayBuffer());
      this.logger.debug('Text to speech conversion completed (WAV format)');
      return buffer;
    } catch (error) {
      this.logger.error(`Error in textToSpeech: ${error.message}`, error.stack);
      throw error;
    }
  }

  // 🎨 이미지 생성 함수 - DALL-E 모델을 사용하여 이미지 생성
  async generateImage(prompt: string): Promise<string> {
    try {
      this.logger.debug('Generating image with prompt:', prompt);
      
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "natural"
      });

      const imageUrl = response.data[0].url;
      this.logger.debug('Generated image URL:', imageUrl);
      
      return imageUrl;
    } catch (error) {
      this.logger.error(`Error in generateImage: ${error.message}`, error.stack);
      throw error;
    }
  }
}