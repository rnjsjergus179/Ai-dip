require('dotenv').config(); // .env 파일에서 환경 변수 로드
const express = require('express');
const cors = require('cors');

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

// `/api/key` 엔드포인트 (GET 요청)
app.get('/api/key', (req, res) => {
  const apiKey = process.env.MY_API_KEY;
  if (apiKey) {
    console.log('[SUCCESS] API 키를 성공적으로 반환했습니다.');
    res.status(200).json({ apiKey });
  } else {
    console.error('[ERROR] API 키를 찾을 수 없습니다.');
    res.status(500).json({ error: 'API 키를 찾을 수 없습니다.' });
  }
});

// 기본 헬스체크 라우트 (GET)
app.get('/', (req, res) => {
  console.log('[SUCCESS] 헬스체크 요청 처리 완료');
  res.send('서버 실행 중');
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 [SERVER] 서버가 포트 ${PORT}에서 실행 중입니다: http://localhost:${PORT}`);
});
