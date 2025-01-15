// 🤖 OpenAI API를 사용하기 위한 필수 모듈 임포트
import { Injectable, Logger } from '@nestjs/common';
import { OpenAIConfig } from '../config/openai.config';
import OpenAI from 'openai';
import { File } from '@web-std/file';
import * as zlib from 'zlib';
import { promisify } from 'util';

// gzip 압축/해제 함수를 프로미스로 변환
const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

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

  // 🎤️ 데이터 압축 유틸리티 함수
  private async compressBuffer(buffer: Buffer): Promise<Buffer> {
    try {
      // GZIP 압축 수행
      return await gzipAsync(buffer);
    } catch (error) {
      this.logger.error(`Error in compressBuffer: ${error.message}`, error.stack);
      throw error;
    }
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
  async generateText(prompt: string, userInput?: string): Promise<string> {
    try {
      this.logger.debug('Generating text with prompt:', prompt + '\n\n');
      // GPT-3.5-turbo 모델을 사용하여 텍스트 생성
      const messages: { role: 'system' | 'user' | 'assistant', content: string }[] = [
        { role: 'system', content: prompt }
      ];
      
      // 사용자 입력이 있는 경우 추가
      if (userInput) {
        messages.push({ role: 'user', content: userInput });
      }

      const completion = await this.openai.chat.completions.create({
        messages,
        model: 'gpt-4o',
      });

      const response = completion.choices[0].message.content;
      this.logger.debug('Generated text:', response + '\n\n');
      return response;
    } catch (error) {
      this.logger.error(`Error in generateText: ${error.message}`, error.stack);
      throw error;
    }
  }

  // 🔍 분석용 텍스트 생성 함수 (GPT-4 모델 사용)
  async generateAnalysis(systemPrompt: string | OpenAI.Chat.ChatCompletionMessageParam[], userPrompt?: string): Promise<string> {
    try {
      this.logger.debug('Generating analysis with system prompt:', systemPrompt);
      this.logger.debug('User prompt for analysis:', userPrompt);

      let messages: OpenAI.Chat.ChatCompletionMessageParam[];

      if (Array.isArray(systemPrompt)) {
        messages = systemPrompt;
      } else {
        messages = [
          { role: 'user' as const, content: `${systemPrompt}\n\n${userPrompt || ''}` }
        ];
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_completion_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content || '';
      this.logger.debug('Generated analysis:', response);

      return response;
    } catch (error) {
      this.logger.error('Error generating analysis:', error);
      throw error;
    }
  }

  // 🔊 텍스트를 음성으로 변환하는 함수 (Text-to-Speech)
  async textToSpeech(text: string): Promise<Buffer> { // 반환 타입을 Buffer로 변경
    try {
      this.logger.debug('Converting text to speech:', text);
      // TTS-1 모델과 Nova 음성을 사용하여 텍스트를 MP3 형식 음성으로 변환
      const audioResponse = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input: text,
        response_format: 'mp3', // 🎵 MP3 형식으로 출력 변경 (더 작은 파일 크기)
        speed: 1.0 // 음성 속도 조절 (1.0이 기본)
      });

      // 🔄 응답을 Buffer로 변환하고 압축
      const buffer = Buffer.from(await audioResponse.arrayBuffer());
      // const compressedBuffer = await this.compressBuffer(buffer);
      
      this.logger.debug('Text to speech conversion and compression completed');
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

  /**
   * 🖼️ 이미지 분석
   */
  async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error(`Error analyzing image: ${error.message}`, error.stack);
      throw new Error('이미지 분석 중 오류가 발생했습니다.');
    }
  }

  /**
   * 🖼️ Vision API를 사용한 이미지 분석
   */
  async analyzeImagesWithVision(
    userImageUrl: string, 
    guideImageUrl: string,
    currentStep: number,
    systemPrompt: string,
    userPrompt: string
  ): Promise<{ score: number; feedback: string }> {
    try {
      this.logger.debug('Vision API로 이미지 분석 시작');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: { 
                  url: guideImageUrl,
                  detail: "high"  
                }
              },
              {
                type: 'image_url',
                image_url: { 
                  url: userImageUrl,
                  detail: "high"  
                }
              }
            ]
          }
        ],
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('이미지 분석 결과가 없습니다');
      }

      this.logger.debug('이미지 분석 결과:', result);
      
      try {
        // 응답 문자열 정리
        const cleanedResult = result.trim();
        // 코드 블록 표시가 있다면 제거
        const jsonStr = cleanedResult.replace(/^```json\n|\n```$/g, '');
        
        return JSON.parse(jsonStr);
      } catch (parseError) {
        this.logger.error('JSON 파싱 실패. 응답:', result);
        throw new Error('응답이 올바른 JSON 형식이 아닙니다. 프롬프트를 확인해주세요.');
      }
    } catch (error) {
      this.logger.error(`Vision API 이미지 분석 중 오류 발생: ${error.message}`, error.stack);
      throw error;
    }
  }

  
}