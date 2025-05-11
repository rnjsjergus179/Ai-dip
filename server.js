require('dotenv').config(); // .env 파일에서 환경 변수 로드
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // node-fetch 패키지 필요
const fs = require('fs'); // 파일 시스템 모듈
const path = require('path'); // 경로 관리 모듈
const { Worker } = require('worker_threads'); // 웹 워커 모듈

const app = express();
const PORT = process.env.PORT || 3000; // .env에서 PORT 사용, 기본값 3000

// 미들웨어 설정
app.use(express.json()); // JSON body 파싱
app.use(cors({
  origin: '*', // 모든 도메인 허용
  methods: ['GET', 'POST'], // GET, POST 메서드 허용
  credentials: true // 인증 정보 포함 허용
}));

// 웹 워커 스크립트 정의
const workerScript = `
  const { parentPort } = require('worker_threads');
  let accumulatedData2 = [];

  parentPort.on('message', async (message) => {
    if (message.type === 'process') {
      const text = message.text;
      accumulatedData2.push(text); // accumulatedData2에 데이터 추가
      console.log('[WORKER] accumulatedData2에 데이터 추가: ' + text);

      // 백엔드에 POST 요청 보내기
      try {
        const response = await fetch('http://localhost:${PORT}/api/save-learning-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        if (response.ok) {
          console.log('[WORKER] 백엔드에 데이터 전송 성공: ' + text);
        } else {
          console.error('[WORKER] 백엔드 전송 실패: ' + response.statusText);
        }
      } catch (error) {
        console.error('[WORKER] 백엔드 전송 중 오류: ' + error.message);
      }
    }
  });
`;

// 웹 워커 초기화
const worker = new Worker(workerScript, { eval: true });

// 워커 이벤트 핸들러
worker.on('message', (msg) => {
  console.log('[SERVER] 워커로부터 메시지 수신: ' + msg);
});

worker.on('error', (error) => {
  console.error('[SERVER] 워커 오류: ' + error);
});

worker.on('exit', (code) => {
  if (code !== 0) {
    console.error('[SERVER] 워커 종료, 코드: ' + code);
  }
});

// `/api/config` 엔드포인트 (GET 요청)
app.get('/api/config', (req, res) => {
  const apiKey = process.env.MY_API_KEY;
  const learningUrl = process.env.LEARNING_TEXT_URL;
  const learningUrl2 = process.env.LEARNING_TEXT_URL_2 || 'https://example.com/파일저장2.txt';
  const port = process.env.PORT || 3000;
  if (apiKey && learningUrl && learningUrl2) {
    console.log('[SUCCESS] API 키, LEARNING_TEXT_URL, LEARNING_TEXT_URL_2, PORT를 성공적으로 반환했습니다.');
    res.status(200).json({ apiKey, learningUrl, learningUrl2, port });
  } else {
    console.error('[ERROR] API 키, LEARNING_TEXT_URL, 또는 LEARNING_TEXT_URL_2를 찾을 수 없습니다.');
    res.status(500).json({ error: 'API 키, LEARNING_TEXT_URL, 또는 LEARNING_TEXT_URL_2를 찾을 수 없습니다.' });
  }
});

// `/api/learning-text` 엔드포인트 (GET 요청)
app.get('/api/learning-text', async (req, res) => {
  const txtUrl = req.query.url;
  if (!txtUrl) {
    console.error('[ERROR] txt URL이 제공되지 않았습니다.');
    return res.status(400).json({ error: 'txt URL이 필요합니다.' });
  }
  try {
    const response = await fetch(txtUrl);
    if (!response.ok) throw new Error('파일을 가져오지 못했습니다.');
    const text = await response.text();
    console.log('[SUCCESS] 파일을 성공적으로 가져왔습니다: ' + txtUrl);
    res.status(200).send(text);
  } catch (error) {
    console.error('[ERROR] 파일 가져오기 실패: ' + error.message);
    res.status(500).json({ error: '파일을 가져오지 못했습니다.' });
  }
});

// `/api/save-learning-text` 엔드포인트 (POST 요청)
app.post('/api/save-learning-text', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    console.error('[ERROR] 저장할 텍스트가 제공되지 않았습니다.');
    return res.status(400).json({ error: '저장할 텍스트가 필요합니다.' });
  }
  try {
    const filePath = path.join(__dirname, '파일저장2.txt');
    fs.appendFileSync(filePath, text + '\n');
    console.log('[SUCCESS] 텍스트가 성공적으로 파일저장2.txt에 저장되었습니다: ' + text); // 터미널에 로그 출력
    res.status(200).json({ message: '텍스트가 성공적으로 저장되었습니다.' });
  } catch (error) {
    console.error('[ERROR] 텍스트 저장 실패: ' + error.message);
    res.status(500).json({ error: '텍스트를 저장하지 못했습니다.' });
  }
});

// 기본 헬스체크 라우트 (GET)
app.get('/', (req, res) => {
  console.log('[SUCCESS] 헬스체크 요청 처리 완료');
  res.send('서버 실행 중');
});

// 서버 시작 및 테스트 메시지 전송
app.listen(PORT, () => {
  console.log(`🚀 [SERVER] 서버가 포트 ${PORT}에서 실행 중입니다: http://localhost:${PORT}`);
  
  // 테스트: 웹 워커에 데이터 전송
  worker.postMessage({ type: 'process', text: '테스트 데이터 1' });
  setTimeout(() => worker.postMessage({ type: 'process', text: '테스트 데이터 2' }), 1000);
});
