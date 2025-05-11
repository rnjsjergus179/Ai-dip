require('dotenv').config(); // .env 파일에서 환경 변수 로드
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // node-fetch 패키지 필요 (설치 필요: npm install node-fetch)
const fs = require('fs'); // 파일 시스템 모듈 추가
const path = require('path'); // 경로 관리 모듈 추가

const app = express();
const PORT = process.env.PORT || 3000; // .env에서 PORT 사용, 기본값 3000

// JSON body 파싱을 위한 미들웨어
app.use(express.json());

// CORS 설정 - 모든 도메인 허용
app.use(cors({
  origin: '*', // 모든 도메인에서 요청 허용
  methods: ['GET', 'POST'], // GET, POST 메서드 허용
  credentials: true // 인증 정보 포함 허용
}));

// `/api/config` 엔드포인트 (GET 요청)
app.get('/api/config', (req, res) => {
  const apiKey = process.env.MY_API_KEY;
  const learningUrl = process.env.LEARNING_TEXT_URL;
  const learningUrl2 = process.env.LEARNING_TEXT_URL_2 || 'https://example.com/파일저장2.txt'; // 두 번째 학습 URL 추가
  const port = process.env.PORT || 3000;
  if (apiKey && learningUrl && learningUrl2) {
    console.log('[SUCCESS] API 키, LEARNING_TEXT_URL, LEARNING_TEXT_URL_2, PORT를 성공적으로 반환했습니다.');
    res.status(200).json({ apiKey, learningUrl, learningUrl2, port });
  } else {
    console.error('[ERROR] API 키, LEARNING_TEXT_URL, 또는 LEARNING_TEXT_URL_2를 찾을 수 없습니다.');
    res.status(500).json({ error: 'API 키, LEARNING_TEXT_URL, 또는 LEARNING_TEXT_URL_2를 찾을 수 없습니다.' });
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

// `/api/save-learning-text` 엔드포인트 (POST 요청) - 두 번째 학습 데이터 누적 저장
app.post('/api/save-learning-text', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    console.error('[ERROR] 저장할 텍스트가 제공되지 않았습니다.');
    return res.status(400).json({ error: '저장할 텍스트가 필요합니다.' });
  }
  try {
    const filePath = path.join(__dirname, '파일저장2.txt'); // 파일저장2.txt 경로 설정
    fs.appendFileSync(filePath, text + '\n'); // 텍스트를 파일에 누적 저장
    console.log('[SUCCESS] 텍스트가 성공적으로 저장되었습니다:', text);
    res.status(200).json({ message: '텍스트가 성공적으로 저장되었습니다.' });
  } catch (error) {
    console.error('[ERROR] 텍스트 저장 실패:', error.message);
    res.status(500).json({ error: '텍스트를 저장하지 못했습니다.' });
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
