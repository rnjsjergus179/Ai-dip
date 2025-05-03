const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { PythonShell } = require('python-shell');
const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');

const logFile = path.join(__dirname, 'server.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

const app = express();
const port = process.env.PORT || 5000;

const predictionCache = new NodeCache({ stdTTL: 600 });

app.use(express.json());

// CORS 설정
app.use(cors({
  origin: [
    'https://rnjsjergus179.github.io',
    'https://www.emotionalail.site'
  ]
}));

// 환경 변수 설정
const MONGO_URI = process.env.MONGO_URI; // MongoDB 연결 URI
const API_KEY = process.env.API_KEY; // 인증용 헤더 키
const MONGO_API_KEY = process.env.MONGO_API_KEY; // API 호출을 위한 고유 키

// MongoDB 토큰 캐싱 변수
let cachedTokens = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1시간 캐시 지속

// MongoDB 토큰 가져오기 함수
async function fetchMongoTokens() {
  const now = Date.now();
  if (cachedTokens && (now - lastFetchTime) < CACHE_DURATION) {
    console.log('[캐시 사용] MongoDB 토큰 캐시에서 가져옴');
    logStream.write(`[${new Date().toISOString()}] [캐시 사용] MongoDB 토큰 캐시에서 가져옴\n`);
    return cachedTokens;
  }

  try {
    console.log('[MongoDB API 호출 전] MongoDB API 요청 시작...');
    logStream.write(`[${new Date().toISOString()}] [MongoDB API 호출 전] MongoDB API 요청 시작...\n`);
    const response = await axios.get(MONGO_URI, {
      headers: {
        'api-key': API_KEY // 인증용 헤더 키 사용
      },
      params: {
        'mongo-api-key': MONGO_API_KEY // API 호출을 위한 고유 키 사용
      }
    });
    const data = response.data;
    console.log('[MongoDB API 호출 성공] 토큰 수:', data.tokens?.length || 0);
    logStream.write(`[${new Date().toISOString()}] [MongoDB API 호출 성공] 토큰 수: ${data.tokens?.length || 0}\n`);
    cachedTokens = data.tokens || [];
    lastFetchTime = now;
    return cachedTokens;
  } catch (error) {
    console.error('[MongoDB API 호출 실패]', error.message);
    logStream.write(`[${new Date().toISOString()}] [MongoDB API 호출 실패] ${error.message}\n`);
    return [];
  }
}

// 텍스트 예측 함수
async function predictText(text) {
  const cachedResponse = predictionCache.get(text);
  if (cachedResponse) {
    console.log('[캐시 사용] 예측 결과 캐시에서 가져옴');
    logStream.write(`[${new Date().toISOString()}] [캐시 사용] 예측 결과 캐시에서 가져옴\n`);
    return cachedResponse;
  }

  return new Promise((resolve, reject) => {
    const options = {
      mode: 'text',
      pythonOptions: ['-u'],
      scriptPath: './',
      args: [text]
    };

    console.log('[Python 호출] 입력 문장:', text);
    logStream.write(`[${new Date().toISOString()}] [Python 호출] 입력 문장: ${text}\n`);
    PythonShell.run('predict.py', options, (err, results) => {
      if (err) {
        console.error('[Python 오류]', err);
        logStream.write(`[${new Date().toISOString()}] [Python 오류] ${err.message}\n`);
        reject(new Error('Python script execution failed'));
      } else {
        console.log('[Python 결과]', results[0]);
        logStream.write(`[${new Date().toISOString()}] [Python 결과] ${results[0]}\n`);
        const response = results[0];
        predictionCache.set(text, response);
        resolve(response);
      }
    });
  });
}

// MongoDB 토큰 조회 엔드포인트
app.get('/mongo-tokens', async (req, res) => {
  const tokens = await fetchMongoTokens();
  res.json({ tokens });
});

// 채팅 예측 엔드포인트
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  console.log('[사용자 메시지 수신]', message);
  logStream.write(`[${new Date().toISOString()}] [사용자 메시지 수신] ${message}\n`);

  try {
    const response = await predictText(message);
    const mongo_tokens = await fetchMongoTokens();
    console.log('[응답 완료]', response);
    logStream.write(`[${new Date().toISOString()}] [응답 완료] ${response}\n`);
    res.json({ response, mongo_tokens });
  } catch (error) {
    console.error('[응답 처리 실패]', error.message);
    logStream.write(`[${new Date().toISOString()}] [응답 처리 실패] ${error.message}\n`);
    res.status(500).json({ error: '예측 중 오류 발생', details: error.message });
  }
});

// 서버 시작
app.listen(port, () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
  logStream.write(`[${new Date().toISOString()}] 서버가 포트 ${port}에서 실행 중입니다.\n`);
});
