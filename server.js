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
    'https://rnjsjergus179.github.io',
    'https://www.emotionalail.site'
  ]
}));

const MONGO_API_URL = 'https://emotionail2-0.onrender.com/mongo-tokens';
const USER_HOMEPAGE = 'https://rnjsjergus179.github.io/-/';

// MongoDB에서 tokens 가져오는 함수
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

// PyTorch 예측 호출
async function predictText(text) {
  return new Promise((resolve, reject) => {
    const options = {
      mode: 'text',
      pythonOptions: ['-u'],
      scriptPath: './',
      args: [text]
    };

    console.log('[PyTorch 호출] 입력 문장:', text);
    PythonShell.run('predict.py', options, (err, results) => {
      if (err) {
        console.error('[PyTorch 오류]', err);
        reject(err);
      } else {
        console.log('[PyTorch 결과]', results[0]);
        resolve(results[0]);
      }
    });
  });
}

// tokens API
app.get('/mongo-tokens', async (req, res) => {
  const tokens = await fetchMongoTokens();
  res.json({ tokens });
});

// 챗봇 응답
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  console.log('[사용자 메시지 수신]', message);

  try {
    const prediction = await predictText(message);
    const tokens = await fetchMongoTokens();
    console.log('[응답 완료]', prediction);
    res.json({ response: prediction, mongo_tokens: tokens });
  } catch (error) {
    console.error('[응답 처리 실패]', error.message);
    res.status(500).json({ error: '예측 중 오류 발생' });
  }
});

app.listen(port, () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
});
