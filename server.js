require('dotenv').config(); // .env 파일에서 환경변수 로드
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000; // 환경변수 PORT 사용, 기본값 3000

// CORS 설정: 환경변수 ALLOWED_ORIGIN으로 허용된 출처 설정
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN, // .env에서 설정된 허용 출처
  methods: ['GET'],
  credentials: true
}));

// 학습용 데이터 제공 엔드포인트
app.get('/api/learning-data', (req, res) => {
  // 1) API 키 인증
  const key = req.query.api_key; // 쿼리스트링에서 api_key 가져오기
  if (key !== process.env.API_KEY) {
    return res.status(403).send('Invalid API key'); // 인증 실패 시 403 응답
  }

  // 2) 파일 읽기 및 응답
  const filePath = path.join(__dirname, '학습용.txt'); // 학습용.txt 파일 경로
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('파일 읽기 오류:', err);
      return res.status(500).send('서버에서 학습용 데이터를 읽지 못했습니다.');
    }
    console.log('파일을 성공적으로 읽었습니다.');
    res.type('text/plain').send(data); // 파일 내용을 텍스트 형식으로 응답
  });
});

// 기본 라우트 (테스트용)
app.get('/', (req, res) => {
  res.send('백엔드 서버가 정상적으로 실행 중입니다.');
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
