require('dotenv').config(); // .env 파일에서 환경 변수 로드
const express = require('express');
const cors = require('cors');
const science = require('./science'); // science.js 모듈 불러오기

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

// `/process` 엔드포인트 (POST 요청)
app.post('/process', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    console.log('[REQUEST] 텍스트가 제공되지 않음');
    return res.status(400).json({ error: '텍스트가 필요합니다.' });
  }
  try {
    const result = await science.processClientRequest(text);
    console.log('[SUCCESS] 요청 처리 완료:', result);
    res.status(200).json(result);
  } catch (error) {
    console.error('[ERROR] 요청 처리 실패:', error.message);
    res.status(500).json({ error: '오류: ' + error.message });
  }
});

// 기본 헬스체크 라우트 (GET)
app.get('/', (req, res) => {
  res.send('서버 실행 중');
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 [SERVER] 서버가 포트 ${PORT}에서 실행 중입니다: http://localhost:${PORT}`);
});
