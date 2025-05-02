const express = require('express');
const cors = require('cors');
const axios = require('axios'); // MongoDB API 호출을 위해 사용
const { PythonShell } = require('python-shell'); // PyTorch 모델 실행을 위해 Python 호출

const app = express();
const port = process.env.PORT || 5000;

// JSON 파싱 미들웨어
app.use(express.json());

// CORS 설정
app.use(cors({
  origin: [
    'https://rnjsjergus179.github.io', // GitHub Pages 주소
    'https://www.emotionalail.site'    // 기존 도메인
  ]
}));

// MongoDB URI 설정 (백엔드에서 제공)
const MONGO_API_URL = 'https://emotionail2-0.onrender.com/mongo-tokens'; // MongoDB URI 엔드포인트

// 사용자의 홈페이지 URL
const USER_HOMEPAGE = 'https://rnjsjergus179.github.io/-/';

// MongoDB에서 tokens 가져오는 함수
async function fetchMongoTokens() {
  try {
    const response = await axios.get(MONGO_API_URL); // API 키 없이 GET 요청으로 호출
    const data = response.data;
    return data.tokens || []; // 백엔드 응답 형식에 맞게 tokens 추출
  } catch (error) {
    console.error(`MongoDB URI 호출 실패: ${error}`);
    return [];
  }
}

// PyTorch 모델 호출을 위한 Python 스크립트 실행 함수
async function predictText(text) {
  return new Promise((resolve, reject) => {
    const options = {
      mode: 'text',
      pythonOptions: ['-u'], // Unbuffered output
      scriptPath: './', // Python 스크립트 경로
      args: [text]
    };

    PythonShell.run('predict.py', options, (err, results) => {
      if (err) {
        reject(err);
      } else {
        const response = results[0];
        resolve(response);
      }
    });
  });
}

// MongoDB tokens 가져오기 엔드포인트
app.get('/mongo-tokens', async (req, res) => {
  const tokens = await fetchMongoTokens();
  res.json({ tokens });
});

// 챗봇 응답 엔드포인트
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  try {
    const prediction = await predictText(message); // Python 스크립트를 통해 예측
    const tokens = await fetchMongoTokens();
    res.json({ response: prediction, mongo_tokens: tokens });
  } catch (error) {
    res.status(500).json({ error: '예측 중 오류 발생' });
  }
});

// 서버 실행
app.listen(port, () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
});
