// learning.js - 백엔드 서버용 라우터 모듈

const express = require('express');
const axios = require('axios');
const router = express.Router();

// 환경 변수 로드 여부 확인 (dotenv는 server.js에서 로드됨)
console.log(`[ENV LOAD] MY_API_KEY 로드 여부: ${process.env.MY_API_KEY ? '성공' : '실패'}`);

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

// 학습용 데이터 제공 라우트 (GET /api/learning-data)
router.get('/learning-data', verifyApiKey, async (req, res) => {
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

// 채팅 메시지 처리 라우트 (POST /api/send-message)
router.post('/send-message', verifyApiKey, async (req, res) => {
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

// 모듈 내보내기
module.exports = router;
