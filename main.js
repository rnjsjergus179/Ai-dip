// main.js

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');

const BACKEND_URL = 'https://dibreoning-caesbos.onrender.com';
let MY_API_KEY = '';
let LEARNING_TEXT_URL = '';
let isWorkerInitialized = false;

async function fetchBackendData() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/config`);
    if (!response.ok) throw new Error(`백엔드 응답 실패: ${response.status} ${response.statusText}`);
    const data = await response.json();
    MY_API_KEY = data.apiKey;
    LEARNING_TEXT_URL = data.learningUrl;
    return true;
  } catch (error) {
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
    const result = text.replace(/[^가-힣a-zA-Z0-9\\s]/g, '').toLowerCase().trim();
    return result;
  }

  function tokenizeText(text) {
    const result = text.split(/\\s+/).filter(word => word.length > 0);
    return result;
  }

  function vectorizeText(tokens, vocab) {
    const vector = new Array(300).fill(0);
    tokens.forEach(token => {
      const index = vocab.indexOf(token) % 300;
      if (index >= 0) vector[index] += 1;
    });
    return vector;
  }

  function vectorToSpikes(vector) {
    const result = vector.map(val => val > 0 ? 1 : 0);
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
      console.log('[학습] train 함수 시작');
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
      console.log('[학습] train 함수 완료');
    }
  }

  function wernickeArea(text) {
    try {
      const tokens = tokenizeText(refineText(text));
      const result = vectorizeText(tokens, vocabulary);
      return result;
    } catch (error) {
      throw error;
    }
  }

  function brocaArea(intent) {
    const responses = {
      greeting: ["안녕하세요!", "반갑습니다!", "안녕!"],
      question: ["질문에 대한 답변을 준비 중입니다.", "곧 답변드리겠습니다."],
      request: ["요청을 처리 중입니다.", "곧 도와드리겠습니다!"],
      science: ["과학 관련 질문이군요!", "흥미로운 주제입니다!"],
      unknown: ["죄송합니다, 이해하지 못했습니다."]
    };
    const result = responses[intent] ? responses[intent][Math.floor(Math.random() * responses[intent].length)] : "죄송합니다, 이해하지 못했습니다.";
    return result;
  }

  function angularGyrus(text) {
    try {
      const tokens = tokenizeText(refineText(text));
      const result = tokens.length > 0 ? 'valid' : 'invalid';
      return result;
    } catch (error) {
      throw error;
    }
  }

  function prefrontalCortex(text, intent) {
    try {
      const angularResult = angularGyrus(text);
      const result = angularResult === 'invalid' ? 'unknown' : 
        (intent === 'unknown' && conversationHistory.length > 0 ? 
          identifyIntent(conversationHistory[conversationHistory.length - 1]) : intent);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async function loadData(apiKey, learningUrl, savedWeights) {
    if (!apiKey || !learningUrl) {
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
      self.postMessage({ type: 'initComplete' });
    } catch (error) {
      self.postMessage({ type: 'initError', message: error.message });
    }
  }

  function identifyIntent(text) {
    try {
      if (!mlpSnnModel) {
        return 'unknown';
      }
      const vector = wernickeArea(text);
      const result = mlpSnnModel.predict(vector);
      return result;
    } catch (error) {
      return 'unknown';
    }
  }

  function autoSpike() {
    console.log('[학습] autoSpike 시작');
    try {
      if (conversationHistory.length > 0 && mlpSnnModel) {
        const lastText = conversationHistory[conversationHistory.length - 1];
        const intent = identifyIntent(lastText);
        intentGroups[intent].push(lastText);
        mlpSnnModel.train(wernickeArea(lastText), intent);
        console.log('[학습] autoSpike 성공');
      } else {
        console.log('[학습] autoSpike: 실행 조건 미충족');
      }
    } catch (error) {
      console.log('[학습] autoSpike 실패:', error.message);
    }
  }

  setInterval(autoSpike, 5000);

  self.onmessage = function(e) {
    const { type, text, apiKey, learningUrl, savedWeights } = e.data;
    if (type === 'init') {
      loadData(apiKey, learningUrl, savedWeights);
    } else if (type === 'process') {
      try {
        if (!mlpSnnModel) {
          self.postMessage({ type: 'processed', data: { intent: 'unknown', reply: '👾 챗봇: 초기화 중입니다. 잠시 기다려주세요.' } });
          return;
        }
        conversationHistory.push(text);
        const intent = identifyIntent(text);
        const refinedIntent = prefrontalCortex(text, intent);
        const reply = brocaArea(refinedIntent);
        mlpSnnModel.train(wernickeArea(text), refinedIntent);
        self.postMessage({ type: 'processed', data: { intent: refinedIntent, reply: "👾 챗봇: " + reply } });
      } catch (error) {
        self.postMessage({ type: 'processed', data: { intent: 'unknown', reply: '👾 챗봇: 처리 중 오류가 발생했습니다.' } });
      }
    }
  };
`;

const blob = new Blob([workerScript], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));

function appendBubble(text, sender) {
  const bubble = document.createElement('div');
  bubble.classList.add('bubble', sender);
  bubble.textContent = text;
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

worker.onmessage = function(e) {
  const { type, data, message, weights } = e.data;
  if (type === 'processed' && data) {
    appendBubble(data.reply, 'bot');
  } else if (type === 'saveWeights' && weights) {
    localStorage.setItem('modelWeights', JSON.stringify(weights));
  } else if (type === 'initError' && message) {
    appendBubble(`👾 챗봇: 초기화 오류 - ${message}`, 'bot');
  } else if (type === 'initComplete') {
    isWorkerInitialized = true;
    appendBubble('안녕하세요! AI 챗봇입니다. 무엇을 도와드릴까요?', 'bot');
  }
};

function processMessage(text) {
  if (!text) return;
  appendBubble(text, 'user');
  if (!isWorkerInitialized) {
    appendBubble('👾 챗봇: 초기화 중입니다. 잠시 기다려주세요.', 'bot');
    return;
  }
  worker.postMessage({ type: 'process', text, apiKey: MY_API_KEY, learningUrl: LEARNING_TEXT_URL });
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
  const success = await fetchBackendData();
  if (success && MY_API_KEY && LEARNING_TEXT_URL) {
    const savedWeights = JSON.parse(localStorage.getItem('modelWeights') || 'null');
    worker.postMessage({ type: 'init', apiKey: MY_API_KEY, learningUrl: LEARNING_TEXT_URL, savedWeights });
  } else {
    appendBubble('👾 챗봇: 초기화 실패 - 백엔드 설정을 확인해주세요.', 'bot');
  }
})();
