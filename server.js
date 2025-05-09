require('dotenv').config(); // .env 파일에서 환경 변수 로드
const express = require('express');
const cors = require('cors');
const learningRouter = require('./learning.js'); // learning.js 라우터 모듈 불러오기

const app = express();
const PORT = process.env.PORT || 3000; // 환경 변수 PORT 사용, 기본값 3000

// JSON body 파싱을 위한 미들웨어
app.use(express.json());

// CORS 설정 - 모든 출처 허용
app.use(cors({
  origin: '*', // 모든 출처 허용
  methods: ['GET', 'POST'], // GET, POST 메서드 허용
  credentials: true // 인증 정보 포함 허용
}));

// `/api` 아래에 learning.js 라우터 마운트
app.use('/api', learningRouter);

// 기본 헬스체크 라우트 (GET)
app.get('/', (req, res) => {
  res.send('서버 실행 중');
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 [SERVER] 서버가 포트 ${PORT}에서 실행 중입니다: http://localhost:${PORT}`);
});
