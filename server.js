const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { PythonShell } = require('python-shell');

const app = express();
const port = process.env.PORT || 5000;

// Middleware to parse JSON requests
app.use(express.json());

// CORS configuration for allowed frontends
app.use(cors({
  origin: [
    'https://rnjsjergus179.github.io',
    'https://www.emotionalail.site'
  ]
}));

// MongoDB Data API endpoint
const MONGO_API_URL = 'https://emotionail2-0.onrender.com/mongo-tokens';

// Function to fetch tokens from MongoDB Data API
async function fetchMongoTokens() {
  try {
    console.log('[MongoDB API 호출 전] MongoDB API 요청 시작...');
    const response = await axios.get(MONGO_API_URL);
    const data = response.data;
    console.log('[MongoDB API 호출 성공] 토큰 수:', data.tokens?.length || 0);
    return data.tokens || [];
  } catch (error) {
    console.error('[MongoDB API 호출 실패]', error.message);
    return [];
  }
}

// Function to call Python predict script
async function predictText(text) {
  return new Promise((resolve, reject) => {
    const options = {
      mode: 'text',
      pythonOptions: ['-u'], // Unbuffered output
      scriptPath: './',
      args: [text]
    };

    console.log('[Python 호출] 입력 문장:', text);
    PythonShell.run('predict.py', options, (err, results) => {
      if (err) {
        console.error('[Python 오류]', err);
        reject(err);
      } else {
        console.log('[Python 결과]', results[0]);
        resolve(results[0]); // Single-line string response
      }
    });
  });
}

// GET /mongo-tokens endpoint
app.get('/mongo-tokens', async (req, res) => {
  const tokens = await fetchMongoTokens();
  res.json({ tokens });
});

// POST /chat endpoint
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  console.log('[사용자 메시지 수신]', message);

  try {
    const response = await predictText(message); // Call Python script
    const mongo_tokens = await fetchMongoTokens(); // Fetch tokens
    console.log('[응답 완료]', response);
    res.json({ response, mongo_tokens });
  } catch (error) {
    console.error('[응답 처리 실패]', error.message);
    res.status(500).json({ error: '예측 중 오류 발생' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
});
