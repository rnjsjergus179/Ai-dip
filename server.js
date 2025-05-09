const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000; // 기본 포트 설정 (필요 시 변경 가능)

// CORS 설정: 프론트엔드에서 접근 허용
app.use(cors({
  origin: 'http://localhost:8000', // 프론트엔드 주소 (필요 시 수정)
  methods: ['GET'],
  credentials: true
}));

// "학습용.txt" 파일 제공 엔드포인트
app.get('/api/learning-data', (req, res) => {
  const filePath = path.join(__dirname, '학습용.txt'); // 파일 경로
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('파일 읽기 오류:', err);
      return res.status(500).send('서버에서 학습용 데이터를 읽지 못했습니다.');
    }
    console.log('파일을 성공적으로 읽었습니다.');
    res.send(data); // 파일 내용을 응답으로 전송
  });
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});

// 기본 라우트 (테스트용)
app.get('/', (req, res) => {
  res.send('백엔드 서버가 정상적으로 실행 중입니다.');
});
