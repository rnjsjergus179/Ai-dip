require('dotenv').config(); // .env 파일에서 환경변수 로드
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN,
  methods: ['GET'],
  credentials: true
}));

// 학습용 데이터 제공 엔드포인트
app.get('/api/learning-data', async (req, res) => {
  const key = req.query.api_key;
  if (process.env.API_KEY && key !== process.env.API_KEY) {
    return res.status(403).send('Invalid API key');
  }

  try {
    const response = await axios.get(process.env.LEARNING_TEXT_URL);
    const text = response.data;
    res.type('text/plain').send(text);
  } catch (error) {
    console.error('학습용.txt 파일을 가져오는 중 오류:', error);
    res.status(500).send('학습용 데이터를 가져오지 못했습니다.');
  }
});

// 테스트용 루트
app.get('/', (req, res) => {
  res.send('서버 실행 중');
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
