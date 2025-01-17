import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// 환경변수 로드
dotenv.config();

// MongoDB 연결 URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/grimMadang';

// 추가할 토픽 이미지 데이터
const topicImages = [
  {
    topic: '해바라기',
    imageUrl: 'https://grimmadang.s3.ap-northeast-2.amazonaws.com/demonstrating/flower/%ED%95%B4%EB%B0%94%EB%9D%BC%EA%B8%B0.jpg',
  },
  {
    topic: '튤립',
    imageUrl: 'https://grimmadang.s3.ap-northeast-2.amazonaws.com/demonstrating/flower/%ED%8A%A4%EB%A6%BD.jpg',
  },
  {
    topic: '카네이션',
    imageUrl: 'https://grimmadang.s3.ap-northeast-2.amazonaws.com/demonstrating/flower/%EC%B9%B4%EB%84%A4%EC%9D%B4%EC%85%98.jpg',
  },
  {
    topic: '장미',
    imageUrl: 'https://grimmadang.s3.ap-northeast-2.amazonaws.com/demonstrating/flower/%EC%9E%A5%EB%AF%B8.jpg',
  },
  {
    topic: '은방울꽃',
    imageUrl: 'https://grimmadang.s3.ap-northeast-2.amazonaws.com/demonstrating/flower/%EC%9D%80%EB%B0%A9%EC%9A%B8%EA%BD%83.jpg',
  },
  {
    topic: '벚꽃',
    imageUrl: 'https://grimmadang.s3.ap-northeast-2.amazonaws.com/demonstrating/flower/%EB%B2%9A%EA%BD%83.jpg',
  },
  {
    topic: '동백꽃',
    imageUrl: 'https://grimmadang.s3.ap-northeast-2.amazonaws.com/demonstrating/flower/%EB%8F%99%EB%B0%B1%EA%BD%83.jpeg',
  },
  {
    topic: '금잔화',
    imageUrl: 'https://grimmadang.s3.ap-northeast-2.amazonaws.com/demonstrating/flower/%EA%B8%88%EC%9E%94%ED%99%94.jpg',
  }
];

async function addTopicImages() {
  let client: MongoClient | null = null;

  try {
    // MongoDB 연결
    client = await MongoClient.connect(MONGODB_URI);
    console.log('MongoDB 연결 성공');

    const db = client.db();
    const collection = db.collection('topicimages');

    // 각 토픽 이미지 추가
    for (const imageData of topicImages) {
      // 이미 존재하는지 확인
      const existing = await collection.findOne({ topic: imageData.topic });
      
      if (existing) {
        console.log(`토픽 "${imageData.topic}"는 이미 존재함. 건너뜀.`);
        continue;
      }

      // 새 데이터 추가
      const now = new Date();
      await collection.insertOne({
        ...imageData,
        createdAt: now,
        updatedAt: now,
        __v: 0  // Mongoose versionKey
      });

      console.log(`토픽 "${imageData.topic}" 추가 완료`);
    }

    console.log('모든 토픽 이미지 추가 완료');

  } catch (error) {
    console.error('에러 발생:', error);
    process.exit(1);
  } finally {
    // MongoDB 연결 종료
    if (client) {
      await client.close();
      console.log('MongoDB 연결 종료');
    }
  }
}

// 스크립트 실행
addTopicImages(); 