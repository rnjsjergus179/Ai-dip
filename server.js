require('dotenv').config(); // .env 파일에서 환경변수 로드
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000; // 환경변수 PORT 사용, 기본값 3000

// CORS 설정
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN, // .env에서 허용된 출처 설정
  methods: ['GET'],
  credentials: true
}));

// 학습용 데이터 제공 엔드포인트
app.get('/api/learning-data', async (req, res) => {
  const key = req.query.api_key; // 쿼리 파라미터에서 api_key 가져오기
  if (process.env.API_KEY && key !== process.env.API_KEY) { // .env의 API_KEY와 비교
    return res.status(403).send('Invalid API key'); // 인증 실패 시 403 반환
  }

  try {
    const response = await axios.get(process.env.LEARNING_TEXT_URL); // .env에서 URL로 데이터 요청
    const text = response.data; // 응답 데이터 추출
    res.type('text/plain').send(text); // text/plain 형식으로 클라이언트에 반환
  } catch (error) {
    console.error('학습용.txt 파일을 가져오는 중 오류:', error); // 오류 로그 출력
    res.status(500).send('학습용 데이터를 가져오지 못했습니다.'); // 오류 시 500 반환
  }
});

// 테스트용 기본 라우트
app.get('/', (req, res) => {
  res.send('서버 실행 중'); // 서버 상태 확인용 메시지
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`); // 서버 시작 로그
});
