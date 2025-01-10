import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fetch from 'node-fetch';

@Injectable()
export class S3Service {
  private readonly logger = new Logger('S3 서비스');
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET_NAME;
  }

  /**
   * URL로부터 이미지를 다운로드하고 S3에 업로드
   * @param imageUrl - 다운로드할 이미지 URL
   * @param key - S3에 저장될 파일 키 (경로 포함)
   * @returns 업로드된 이미지의 S3 URL
   */
  async uploadImageFromUrl(imageUrl: string, key: string): Promise<string> {
    try {
      // 이미지 다운로드
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      const imageBuffer = await response.buffer();

      // S3에 업로드
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: imageBuffer,
        ContentType: response.headers.get('content-type'),
      });

      await this.s3Client.send(command);
      this.logger.debug(`Successfully uploaded image to S3: ${key}`);

      // S3 URL 반환
      return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    } catch (error) {
      this.logger.error(`Error uploading image to S3: ${error.message}`, error.stack);
      throw error;
    }
  }
} 