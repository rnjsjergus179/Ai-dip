require('dotenv').config(); // .env 파일에서 환경 변수 로드
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // node-fetch 패키지 필요 (설치 필요: npm install node-fetch)

const app = express();
const PORT = process.env.PORT || 3000; // .env에서 PORT 사용, 기본값 3000

// JSON body 파싱을 위한 미들웨어
app.use(express.json());

// CORS 설정 - .env에서 ALLOWED_ORIGIN을 필수로 사용, 특정 도메인만 허용
const allowedOrigins = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : [];
app.use(cors({
  origin: function (origin, callback) {
    if (allowedOrigins.length === 0) {
      return callback(new Error('CORS 설정 오류: ALLOWED_ORIGIN이 정의되지 않았습니다.'));
    }
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('이 도메인은 CORS 정책에 의해 차단되었습니다.'));
    }
  },
  methods: ['GET', 'POST'], // GET, POST 메서드 허용
  credentials: true // 인증 정보 포함 허용
}));

// `/api/config` 엔드포인트 (GET 요청)
app.get('/api/config', (req, res) => {
  const apiKey = process.env.MY_API_KEY;
  const learningUrl = process.env.LEARNING_TEXT_URL;
  const port = process.env.PORT || 3000;
  if (apiKey && learningUrl) {
    console.log('[SUCCESS] API 키, LEARNING_TEXT_URL, PORT를 성공적으로 반환했습니다.');
    res.status(200).json({ apiKey, learningUrl, port });
  } else {
    console.error('[ERROR] API 키 또는 LEARNING_TEXT_URL을 찾을 수 없습니다.');
    res.status(500).json({ error: 'API 키 또는 LEARNING_TEXT_URL을 찾을 수 없습니다.' });
  }
});

// `/api/learning-text` 엔드포인트 (GET 요청) - 쿼리 파라미터로 txt URL을 받아 파일 가져오기
app.get('/api/learning-text', async (req, res) => {
  const txtUrl = req.query.url; // 쿼리 파라미터로 전달된 txt URL
  if (!txtUrl) {
    console.error('[ERROR] txt URL이 제공되지 않았습니다.');
    return res.status(400).json({ error: 'txt URL이 필요합니다.' });
  }
  try {
    const response = await fetch(txtUrl);
    if (!response.ok) throw new Error('파일을 가져오지 못했습니다.');
    const text = await response.text();
    console.log('[SUCCESS] 파일을 성공적으로 가져왔습니다:', txtUrl);
    res.status(200).send(text);
  } catch (error) {
    console.error('[ERROR] 파일 가져오기 실패:', error.message);
    res.status(500).json({ error: '파일을 가져오지 못했습니다.' });
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
