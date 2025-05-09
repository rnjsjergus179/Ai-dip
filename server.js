require('dotenv').config(); // .env 파일에서 환경 변수 로드
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000; // 환경 변수 PORT 사용, 기본값 3000

// JSON body 파싱을 위한 미들웨어 (POST 요청 처리용)
app.use(express.json());

// 커스텀 CORS 미들웨어: 요청 전·후 및 성공·실패 로그 추가
const customCors = (req, res, next) => {
  const origin = req.headers.origin || '출처 없음';
  console.log(`[CORS BEFORE] 요청 출처: ${origin}, 메서드: ${req.method}, 경로: ${req.path}`);

  if (origin === process.env.ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    console.log(`[CORS SUCCESS] 출처 ${origin} 허용됨`);
    next();
  } else {
    console.log(`[CORS FAIL] 출처 ${origin} 차단됨 - 허용된 출처: ${process.env.ALLOWED_ORIGIN}`);
    res.status(403).send('CORS policy violation');
  }
};

// CORS 미들웨어 적용
app.use(customCors);

// API 키 검증 미들웨어
const verifyApiKey = (req, res, next) => {
  const key = req.query.api_key;
  if (!key) {
    console.log('[API KEY FAIL] API 키가 제공되지 않음');
    return res.status(403).send('API key is required');
  }
  if (key !== process.env.MY_API_KEY) {
    console.log(`[API KEY FAIL] 잘못된 API 키 - 제공된 키: ${key}`);
    return res.status(403).send('Invalid API key');
  }
  console.log('[API KEY SUCCESS] API 키 인증 성공');
  next();
};

// 학습용 데이터 제공 엔드포인트 (GET)
app.get('/api/learning-data', verifyApiKey, async (req, res) => {
  console.log(`[ENDPOINT BEFORE] GET /api/learning-data 요청 시작 - 출처: ${req.headers.origin}`);
  try {
    console.log(`[ENDPOINT PROCESS] 학습용 데이터 가져오기 시도 - URL: ${process.env.LEARNING_TEXT_URL}`);
    const response = await axios.get(process.env.LEARNING_TEXT_URL, {
      headers: { 'Authorization': `Bearer ${process.env.MY_API_KEY}` }
    });
    const text = response.data;
    res.type('text/plain').send(text);
    console.log(`[ENDPOINT SUCCESS] GET /api/learning-data 요청 성공 - 데이터 전송 완료`);
  } catch (error) {
    console.error(`[ENDPOINT FAIL] 학습용 데이터 가져오기 실패 - 오류: ${error.message}`);
    res.status(500).send('학습용 데이터를 가져오지 못했습니다.');
  }
});

// 채팅 메시지 처리 엔드포인트 (POST)
app.post('/api/send-message', verifyApiKey, async (req, res) => {
  console.log(`[ENDPOINT BEFORE] POST /api/send-message 요청 시작 - 출처: ${req.headers.origin}`);
  const { message } = req.body;
  if (!message) {
    console.log(`[ENDPOINT FAIL] 메시지 누락`);
    return res.status(400).json({ error: '메시지를 보내주세요.' });
  }
  try {
    console.log(`[ENDPOINT PROCESS] 메시지 처리 중 - 입력 메시지: "${message}"`);
    const reply = `👾 에코봇: "${message}"라고 하셨군요!`;
    res.json({ reply });
    console.log(`[ENDPOINT SUCCESS] POST /api/send-message 요청 성공 - 응답: "${reply}"`);
  } catch (error) {
    console.error(`[ENDPOINT FAIL] 메시지 처리 실패 - 오류: ${error.message}`);
    res.status(500).json({ error: '서버 오류로 메시지 처리 실패' });
  }
});

// 테스트용 기본 라우트 (GET)
app.get('/', (req, res) => {
  console.log(`[ENDPOINT BEFORE] GET / 요청 시작 - 출처: ${req.headers.origin}`);
  res.send('서버 실행 중');
  console.log(`[ENDPOINT SUCCESS] GET / 요청 성공 - 응답: "서버 실행 중"`);
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`[SERVER] 서버가 포트 ${PORT}에서 실행 중입니다.`);
});
