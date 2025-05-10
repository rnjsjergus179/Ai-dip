// main.js

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');

const BACKEND_URL = 'https://dibreoning-caesbos.onrender.com';
let MY_API_KEY = '';
let LEARNING_TEXT_URL = '';
let isWorkerInitialized = false;

async function fetchBackendData() {
  console.log('[INFO] 백엔드 설정 요청 시작');
  try {
    const response = await fetch(`${BACKEND_URL}/api/config`);
    if (!response.ok) throw new Error(`백엔드 응답 실패: ${response.status} ${response.statusText}`);
    const data = await response.json();
    MY_API_KEY = data.apiKey;
    LEARNING_TEXT_URL = data.learningUrl;
    console.log('[SUCCESS] 백엔드 설정 요청 성공:', { MY_API_KEY, LEARNING_TEXT_URL });
    return true;
  } catch (error) {
    console.error('[ERROR] 백엔드 설정 요청 실패:', error.message);
    appendBubble('👾 챗봇: 백엔드 연결에 실패했습니다. 서버를 확인해주세요.', 'bot');
    return false;
  }
}

const workerScript = `
  let vocabulary = [];
  let mlpSnnModel = null;
  let intentGroups = { greeting: [], question: [], request: [], science: [], unknown: [] };
  let conversationHistory = [];

  function refineText(text) {
    console.log('[INFO] refineText 시작');
    const result = text.replace(/[^가-힣a-zA-Z0-9\\s]/g, '').toLowerCase().trim();
    console.log('[SUCCESS] refineText 성공:', result);
    return result;
  }

  function tokenizeText(text) {
    console.log('[INFO] tokenizeText 시작');
    const result = text.split(/\\s+/).filter(word => word.length > 0);
    console.log('[SUCCESS] tokenizeText 성공:', result);
    return result;
  }

  function vectorizeText(tokens, vocab) {
    console.log('[INFO] vectorizeText 시작');
    const vector = new Array(300).fill(0);
    tokens.forEach(token => {
      const index = vocab.indexOf(token) % 300;
      if (index >= 0) vector[index] += 1;
    });
    console.log('[SUCCESS] vectorizeText 성공');
    return vector;
  }

  function vectorToSpikes(vector) {
    console.log('[INFO] vectorToSpikes 시작');
    const result = vector.map(val => val > 0 ? 1 : 0);
    console.log('[SUCCESS] vectorToSpikes 성공');
    return result;
  }

  class MLPSNN {
    constructor(inputSize, mlpHiddenSize, snnHiddenSize, outputSize, weights = null) {
      this.inputSize = inputSize;
      this.mlpHiddenSize = mlpHiddenSize;
      this.snnHiddenSize = snnHiddenSize;
      this.outputSize = outputSize;

      if (weights) {
        this.mlpWeightsIH = weights.mlpWeightsIH;
        this.mlpWeightsHH = weights.mlpWeightsHH;
        this.mlpWeightsHO = weights.mlpWeightsHO;
        this.snnWeightsIH = weights.snnWeightsIH;
        this.snnWeightsHO = weights.snnWeightsHO;
      } else {
        this.mlpWeightsIH = this.initializeWeights(mlpHiddenSize, inputSize);
        this.mlpWeightsHH = this.initializeWeights(mlpHiddenSize, mlpHiddenSize);
        this.mlpWeightsHO = this.initializeWeights(snnHiddenSize, mlpHiddenSize);
        this.snnWeightsIH = this.initializeWeights(snnHiddenSize, snnHiddenSize);
        this.snnWeightsHO = this.initializeWeights(outputSize, snnHiddenSize);
      }
      this.threshold = 1.0;
      this.leak = 0.9;
      this.membrane = new Array(snnHiddenSize).fill(0);
    }

    initializeWeights(rows, cols) {
      return new Array(rows).fill(0).map(() => 
        new Array(cols).fill(0).map(() => Math.random() - 0.5));
    }

    relu(x) {
      return Math.max(0, x);
    }

    mlpForward(input) {
      const hidden1 = new Array(this.mlpHiddenSize).fill(0).map((_, i) => {
        let sum = 0;
        for (let j = 0; j < this.inputSize; j++) {
          sum += this.mlpWeightsIH[i][j] * input[j];
        }
        return this.relu(sum);
      });

      const hidden2 = new Array(this.mlpHiddenSize).fill(0).map((_, i) => {
        let sum = 0;
        for (let j = 0; j < this.mlpHiddenSize; j++) {
          sum += this.mlpWeightsHH[i][j] * hidden1[j];
        }
        return this.relu(sum);
      });

      const mlpOutput = new Array(this.snnHiddenSize).fill(0).map((_, i) => {
        let sum = 0;
        for (let j = 0; j < this.mlpHiddenSize; j++) {
          sum += this.mlpWeightsHO[i][j] * hidden2[j];
        }
        return sum;
      });

      return { hidden1, hidden2, mlpOutput };
    }

    snnPredict(mlpOutput) {
      const spikesInput = vectorToSpikes(mlpOutput);
      const hiddenSpikes = new Array(this.snnHiddenSize).fill(0);
      const outputSpikes = new Array(this.outputSize).fill(0);

      for (let t = 0; t < 10; t++) {
        for (let i = 0; i < this.snnHiddenSize; i++) {
          let sum = 0;
          for (let j = 0; j < this.snnHiddenSize; j++) {
            sum += this.snnWeightsIH[i][j] * spikesInput[j];
          }
          this.membrane[i] = this.membrane[i] * this.leak + sum;
          if (this.membrane[i] > this.threshold) {
            hiddenSpikes[i] = 1;
            this.membrane[i] = 0;
          } else {
            hiddenSpikes[i] = 0;
          }
        }

        for (let i = 0; i < this.outputSize; i++) {
          let sum = 0;
          for (let j = 0; j < this.snnHiddenSize; j++) {
            sum += this.snnWeightsHO[i][j] * hiddenSpikes[j];
          }
          outputSpikes[i] += sum;
        }
      }

      const maxIndex = outputSpikes.indexOf(Math.max(...outputSpikes));
      return ['greeting', 'question', 'request', 'science', 'unknown'][maxIndex];
    }

    predict(input) {
      const { mlpOutput } = this.mlpForward(input);
      return this.snnPredict(mlpOutput);
    }

    train(input, target, learningRate = 0.01) {
      const { hidden1, hidden2, mlpOutput } = this.mlpForward(input);
      const outputSpikes = new Array(this.outputSize).fill(0);
      const targetVector = new Array(this.outputSize).fill(0);
      const intentIndex = ['greeting', 'question', 'request', 'science', 'unknown'].indexOf(target);
      targetVector[intentIndex] = 1;

      const spikesInput = vectorToSpikes(mlpOutput);
      for (let t = 0; t < 10; t++) {
        const hiddenSpikes = new Array(this.snnHiddenSize).fill(0);
        for (let i = 0; i < this.snnHiddenSize; i++) {
          let sum = 0;
          for (let j = 0; j < this.snnHiddenSize; j++) {
            sum += this.snnWeightsIH[i][j] * spikesInput[j];
          }
          this.membrane[i] = this.membrane[i] * this.leak + sum;
          if (this.membrane[i] > this.threshold) {
            hiddenSpikes[i] = 1;
            this.membrane[i] = 0;
          }
        }
        for (let i = 0; i < this.outputSize; i++) {
          let sum = 0;
          for (let j = 0; j < this.snnHiddenSize; j++) {
            sum += this.snnWeightsHO[i][j] * hiddenSpikes[j];
          }
          outputSpikes[i] += sum;
        }
      }

      const outputError = outputSpikes.map((o, i) => targetVector[i] - o);
      for (let i = 0; i < this.outputSize; i++) {
        for (let j = 0; j < this.snnHiddenSize; j++) {
          this.snnWeightsHO[i][j] += learningRate * outputError[i] * spikesInput[j];
        }
      }

      const mlpError = new Array(this.snnHiddenSize).fill(0).map((_, i) => {
        let sum = 0;
        for (let j = 0; j < this.outputSize; j++) {
          sum += this.snnWeightsHO[j][i] * outputError[j];
        }
        return sum;
      });

      for (let i = 0; i < this.snnHiddenSize; i++) {
        for (let j = 0; j < this.mlpHiddenSize; j++) {
          this.mlpWeightsHO[i][j] += learningRate * mlpError[i] * hidden2[j];
        }
      }

      self.postMessage({
        type: 'saveWeights',
        weights: {
          mlpWeightsIH: this.mlpWeightsIH,
          mlpWeightsHH: this.mlpWeightsHH,
          mlpWeightsHO: this.mlpWeightsHO,
          snnWeightsIH: this.snnWeightsIH,
          snnWeightsHO: this.snnWeightsHO
        }
      });
    }
  }

  function wernickeArea(text) {
    console.log('[INFO] wernickeArea 시작');
    try {
      const tokens = tokenizeText(refineText(text));
      const result = vectorizeText(tokens, vocabulary);
      console.log('[SUCCESS] wernickeArea 성공');
      return result;
    } catch (error) {
      console.error('[ERROR] wernickeArea 실패:', error.message);
      throw error;
    }
  }

  function brocaArea(intent) {
    console.log('[INFO] brocaArea 시작');
    const responses = {
      greeting: ["안녕하세요!", "반갑습니다!", "안녕!"],
      question: ["질문에 대한 답변을 준비 중입니다.", "곧 답변드리겠습니다."],
      request: ["요청을 처리 중입니다.", "곧 도와드리겠습니다!"],
      science: ["과학 관련 질문이군요!", "흥미로운 주제입니다!"],
      unknown: ["죄송합니다, 이해하지 못했습니다."]
    };
    const result = responses[intent] ? responses[intent][Math.floor(Math.random() * responses[intent].length)] : "죄송합니다, 이해하지 못했습니다.";
    console.log('[SUCCESS] brocaArea 성공:', result);
    return result;
  }

  function angularGyrus(text) {
    console.log('[INFO] angularGyrus 시작');
    try {
      const tokens = tokenizeText(refineText(text));
      const result = tokens.length > 0 ? 'valid' : 'invalid';
      console.log('[SUCCESS] angularGyrus 성공:', result);
      return result;
    } catch (error) {
      console.error('[ERROR] angularGyrus 실패:', error.message);
      throw error;
    }
  }

  function prefrontalCortex(text, intent) {
    console.log('[INFO] prefrontalCortex 시작');
    try {
      const angularResult = angularGyrus(text);
      const result = angularResult === 'invalid' ? 'unknown' : 
        (intent === 'unknown' && conversationHistory.length > 0 ? 
          identifyIntent(conversationHistory[conversationHistory.length - 1]) : intent);
      console.log('[SUCCESS] prefrontalCortex 성공:', result);
      return result;
    } catch (error) {
      console.error('[ERROR] prefrontalCortex 실패:', error.message);
      throw error;
    }
  }

  async function loadData(apiKey, learningUrl, savedWeights) {
    console.log('[INFO] loadData 시작');
    if (!apiKey || !learningUrl) {
      console.error('[ERROR] loadData 실패: API 키 또는 학습 URL 누락');
      self.postMessage({ type: 'initError', message: 'API 키 또는 학습 URL이 필요합니다.' });
      return;
    }
    try {
      const proxyUrl = \`${BACKEND_URL}/api/learning-text?url=\${encodeURIComponent(learningUrl)}\`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('데이터 로드 실패');
      const text = await response.text();
      const lines = text.split('\\n').filter(line => line.trim());
      const tokenizedTexts = lines.map(line => tokenizeText(refineText(line)));
      vocabulary = [...new Set(tokenizedTexts.flat())];
      mlpSnnModel = new MLPSNN(300, 128, 64, 5, savedWeights);
      conversationHistory = [];
      console.log('[SUCCESS] loadData 성공');
      self.postMessage({ type: 'initComplete' });
    } catch (error) {
      console.error('[ERROR] loadData 실패:', error.message);
      self.postMessage({ type: 'initError', message: error.message });
    }
  }

  function identifyIntent(text) {
    console.log('[INFO] identifyIntent 시작');
    try {
      if (!mlpSnnModel) {
        console.warn('[WARN] identifyIntent: 모델 초기화 안됨');
        return 'unknown';
      }
      const vector = wernickeArea(text);
      const result = mlpSnnModel.predict(vector);
      console.log('[SUCCESS] identifyIntent 성공:', result);
      return result;
    } catch (error) {
      console.error('[ERROR] identifyIntent 실패:', error.message);
      return 'unknown';
    }
  }

  function autoSpike() {
    console.log('[INFO] autoSpike 시작');
    try {
      if (conversationHistory.length > 0 && mlpSnnModel) {
        const lastText = conversationHistory[conversationHistory.length - 1];
        const intent = identifyIntent(lastText);
        intentGroups[intent].push(lastText);
        mlpSnnModel.train(wernickeArea(lastText), intent);
        console.log('[SUCCESS] autoSpike 성공');
      } else {
        console.log('[INFO] autoSpike: 실행 조건 미충족');
      }
    } catch (error) {
      console.error('[ERROR] autoSpike 실패:', error.message);
    }
  }

  setInterval(autoSpike, 5000);

  self.onmessage = function(e) {
    console.log('[INFO] Worker 메시지 수신:', e.data);
    const { type, text, apiKey, learningUrl, savedWeights } = e.data;
    if (type === 'init') {
      loadData(apiKey, learningUrl, savedWeights);
    } else if (type === 'process') {
      try {
        if (!mlpSnnModel) {
          console.warn('[WARN] process: 모델 초기화 안됨');
          self.postMessage({ type: 'processed', data: { intent: 'unknown', reply: '👾 챗봇: 초기화 중입니다. 잠시 기다려주세요.' } });
          return;
        }
        conversationHistory.push(text);
        const intent = identifyIntent(text);
        const refinedIntent = prefrontalCortex(text, intent);
        const reply = brocaArea(refinedIntent);
        mlpSnnModel.train(wernickeArea(text), refinedIntent);
        console.log('[SUCCESS] process 성공');
        self.postMessage({ type: 'processed', data: { intent: refinedIntent, reply: "👾 챗봇: " + reply } });
      } catch (error) {
        console.error('[ERROR] process 실패:', error.message);
        self.postMessage({ type: 'processed', data: { intent: 'unknown', reply: '👾 챗봇: 처리 중 오류가 발생했습니다.' } });
      }
    }
  };
`;

const blob = new Blob([workerScript], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));

function appendBubble(text, sender) {
  console.log('[INFO] appendBubble 시작:', text);
  const bubble = document.createElement('div');
  bubble.classList.add('bubble', sender);
  bubble.textContent = text;
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  console.log('[SUCCESS] appendBubble 성공');
}

worker.onmessage = function(e) {
  console.log('[INFO] Worker로부터 메시지 수신:', e.data);
  const { type, data, message, weights } = e.data;
  if (type === 'processed' && data) {
    appendBubble(data.reply, 'bot');
  } else if (type === 'saveWeights' && weights) {
    console.log('[INFO] 가중치 저장 시작');
    localStorage.setItem('modelWeights', JSON.stringify(weights));
    console.log('[SUCCESS] 가중치 저장 성공');
  } else if (type === 'initError' && message) {
    appendBubble(`👾 챗봇: 초기화 오류 - ${message}`, 'bot');
  } else if (type === 'initComplete') {
    isWorkerInitialized = true;
    appendBubble('안녕하세요! AI 챗봇입니다. 무엇을 도와드릴까요?', 'bot');
  } else {
    console.warn('[WARN] 예상치 못한 Worker 메시지:', e.data);
  }
};

function processMessage(text) {
  console.log('[INFO] processMessage 시작:', text);
  if (!text) {
    console.log('[INFO] processMessage: 텍스트 없음, 종료');
    return;
  }
  appendBubble(text, 'user');
  if (!isWorkerInitialized) {
    appendBubble('👾 챗봇: 초기화 중입니다. 잠시 기다려주세요.', 'bot');
    console.log('[INFO] processMessage: 초기화 미완료');
    return;
  }
  worker.postMessage({ type: 'process', text, apiKey: MY_API_KEY, learningUrl: LEARNING_TEXT_URL });
  console.log('[SUCCESS] processMessage 성공');
}

sendBtn.addEventListener('click', () => {
  const text = inputEl.value.trim();
  if (text) {
    inputEl.value = '';
    processMessage(text);
  }
});

inputEl.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && inputEl.value.trim()) {
    processMessage(inputEl.value.trim());
    inputEl.value = '';
  }
});

(async function init() {
  console.log('[INFO] 초기화 시작');
  const success = await fetchBackendData();
  if (success && MY_API_KEY && LEARNING_TEXT_URL) {
    const savedWeights = JSON.parse(localStorage.getItem('modelWeights') || 'null');
    worker.postMessage({ type: 'init', apiKey: MY_API_KEY, learningUrl: LEARNING_TEXT_URL, savedWeights });
    console.log('[SUCCESS] 초기화 성공');
  } else {
    appendBubble('👾 챗봇: 초기화 실패 - 백엔드 설정을 확인해주세요.', 'bot');
    console.error('[ERROR] 초기화 실패');
  }
})();
