// DOM 요소 가져오기
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');

// 환경 변수 설정
const BACKEND_URL = 'https://dibreoning-caesbos.onrender.com';
let MY_API_KEY = '';
let LEARNING_TEXT_URL = ''; // 학습용 첫 번째 텍스트 파일 URL
let LEARNING_TEXT_URL_2 = ''; // 두 번째 텍스트 파일 URL (파일저장2.txt)
let isWorkerInitialized = false;
const MAX_SENTENCES = 10; // 최대 문장 수 제한

// 백엔드 데이터 가져오기 함수
async function fetchBackendData() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/config`);
    if (!response.ok) throw new Error(`백엔드 응답 실패: ${response.status} ${response.statusText}`);
    const data = await response.json();
    MY_API_KEY = data.apiKey;
    LEARNING_TEXT_URL = data.learningUrl; // 첫 번째 학습 데이터 URL
    LEARNING_TEXT_URL_2 = data.learningUrl2 || `${BACKEND_URL}/파일저장2.txt`; // 두 번째 학습 데이터 URL
    return true;
  } catch (error) {
    appendBubble(`👾 챗봇: 백엔드 연결에 실패했습니다. 오류: ${error.message}`, 'bot');
    return false;
  }
}

// 웹 워커 스크립트 정의
const workerScript = `
  let vocabulary = new Set(); // 첫 번째 단어 집합
  let vocabulary2 = new Set(); // 두 번째 단어 집합 (중복 방지용)
  let mlpSnnModel = null;
  let intentGroups = { greeting: [], question: [], request: [], science: [], unknown: [] };
  let conversationHistory = [];
  let accumulatedData2 = []; // 파일저장2.txt에 저장되는 데이터
  const MAX_SENTENCES = 10; // 최대 문장 수 제한

  // 텍스트 정제 함수
  function refineText(text) {
    return text.replace(/[^가-힣a-zA-Z0-9\\s]/g, '').toLowerCase().trim();
  }

  // 텍스트 토큰화 함수
  function tokenizeText(text) {
    return text.split(/\\s+/).filter(word => word.length > 0);
  }

  // 텍스트 백터화 함수
  function vectorizeText(tokens, vocab) {
    const vector = new Array(300).fill(0);
    tokens.forEach(token => {
      const index = Array.from(vocab).indexOf(token) % 300;
      if (index >= 0) vector[index] += 1;
    });
    return vector;
  }

  // 벡터를 스파이크로 변환
  function vectorToSpikes(vector) {
    return vector.map(val => val > 0 ? 1 : 0);
  }

  // MLPSNN 클래스 정의
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

  // 텍스트를 벡터로 변환 (Wernicke 영역)
  function wernickeArea(text, useSecondVocab = false) {
    const tokens = tokenizeText(refineText(text));
    const vector = vectorizeText(tokens, useSecondVocab ? vocabulary2 : vocabulary);
    self.postMessage({
      type: 'log',
      message: \`텍스트 백터화 완료: "\${text}" -> 벡터 길이: \${vector.length}\`
    });
    return vector;
  }

  // 의도에 따른 응답 생성 (Broca 영역)
  function brocaArea(intent) {
    const responses = {
      greeting: ["안녕하세요!", "반갑습니다!", "안녕!"],
      question: ["질문에 대한 답변을 준비 중입니다.", "곧 답변드리겠습니다."],
      request: ["요청을 처리 중입니다.", "곧 도와드리겠습니다!"],
      science: ["과학 관련 질문이군요!", "흥미로운 주제입니다!"],
      unknown: ["죄송합니다, 이해하지 못했습니다."]
    };
    return responses[intent] ? responses[intent][Math.floor(Math.random() * responses[intent].length)] : "죄송합니다, 이해하지 못했습니다.";
  }

  // 텍스트 유효성 검사 (Angular Gyrus)
  function angularGyrus(text) {
    const tokens = tokenizeText(refineText(text));
    return tokens.length > 0 ? 'valid' : 'invalid';
  }

  // 전전두엽 피질을 사용한 의도 결정 및 데이터 판단 (Prefrontal Cortex)
  function prefrontalCortex(text, intent) {
    const angularResult = angularGyrus(text);
    if (angularResult === 'invalid') return 'unknown';

    const tokens = tokenizeText(refineText(text));
    // 중복 단어 체크
    let newWords = tokens.filter(word => !vocabulary2.has(word));
    if (newWords.length > 0 && accumulatedData2.length < MAX_SENTENCES) {
      accumulatedData2.push(text);
      if (accumulatedData2.length > MAX_SENTENCES) {
        accumulatedData2.shift(); // 가장 오래된 문장 제거
      }
      newWords.forEach(word => vocabulary2.add(word)); // 새로운 단어만 추가
      self.postMessage({ type: 'saveAccumulatedData2', data: accumulatedData2 });
      self.postMessage({ type: 'saveVocabulary2', data: Array.from(vocabulary2) });
      self.postMessage({
        type: 'log',
        message: \`새로운 단어 추가: \${newWords.join(', ')}\`
      });
      self.postMessage({
        type: 'log',
        message: \`accumulatedData2에 추가된 텍스트: "\${text}" (현재 \${accumulatedData2.length}/\${MAX_SENTENCES})\`
      });

      // 백엔드에 저장 요청
      fetch(\`${BACKEND_URL}/api/save-learning-text\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      }).then(response => {
        if (!response.ok) {
          self.postMessage({ type: 'log', message: \`파일저장2.txt 저장 실패: \${response.status}\` });
        } else {
          self.postMessage({ type: 'log', message: \`파일저장2.txt에 저장 성공: \${text}\` });
        }
      }).catch(error => {
        self.postMessage({ type: 'log', message: \`파일저장2.txt 저장 오류: \${error.message}\` });
      });
    } else {
      self.postMessage({
        type: 'log',
        message: '새로운 단어가 없거나 문장 제한에 도달하여 저장하지 않습니다.'
      });
    }

    return intent === 'unknown' && conversationHistory.length > 0 
      ? identifyIntent(conversationHistory[conversationHistory.length - 1]) 
      : intent;
  }

  // 학습 데이터 로드 및 초기화
  async function loadData(apiKey, learningUrl, learningUrl2, savedWeights, initialData) {
    vocabulary = new Set(initialData.vocabulary);
    vocabulary2 = new Set(initialData.vocabulary2);
    conversationHistory = initialData.conversationHistory;
    accumulatedData2 = initialData.accumulatedData2;

    if (!apiKey || !learningUrl || !learningUrl2) {
      self.postMessage({ type: 'initError', message: 'API 키 또는 학습 URL이 필요합니다.' });
      return;
    }
    try {
      // 첫 번째 학습 데이터 로드 (학습용.txt)
      const proxyUrl1 = \`${BACKEND_URL}/api/learning-text?url=\${encodeURIComponent(learningUrl)}\`;
      let text1 = '';
      try {
        const response1 = await fetch(proxyUrl1);
        if (!response1.ok) throw new Error('첫 번째 데이터 로드 실패');
        text1 = await response1.text();
        self.postMessage({
          type: 'log',
          message: \`학습용.txt 불러오기 성공 (문자 수: \${text1.length})\`
        });
      } catch (error) {
        self.postMessage({ type: 'warning', message: '학습용.txt를 불러오지 못했습니다. 빈 데이터로 진행합니다.' });
      }
      const lines1 = text1.split('\\n').filter(line => line.trim());
      const tokenizedTexts1 = lines1.map(line => tokenizeText(refineText(line)));
      vocabulary = new Set(tokenizedTexts1.flat());
      conversationHistory = lines1; // 초기 대화 기록에 학습용.txt 데이터 전체 추가
      self.postMessage({ type: 'saveConversationHistory', data: conversationHistory });
      self.postMessage({ type: 'saveVocabulary', data: Array.from(vocabulary) });
      self.postMessage({
        type: 'log',
        message: \`vocabulary에 저장된 단어 수: \${vocabulary.size}개, 예시: \${Array.from(vocabulary).slice(0, 20).join(', ')}\`
      });

      // 두 번째 학습 데이터 로드 (파일저장2.txt)
      const proxyUrl2 = \`${BACKEND_URL}/api/learning-text?url=\${encodeURIComponent(learningUrl2)}\`;
      let text2 = '';
      try {
        const response2 = await fetch(proxyUrl2);
        if (!response2.ok) throw new Error('두 번째 데이터 로드 실패');
        text2 = await response2.text();
        self.postMessage({
          type: 'log',
          message: \`파일저장2.txt 불러오기 성공 (문자 수: \${text2.length})\`
        });
      } catch (error) {
        self.postMessage({ type: 'warning', message: '파일저장2.txt를 불러오지 못했습니다. 빈 데이터로 진행합니다.' });
      }
      const lines2 = text2.split('\\n').filter(line => line.trim());
      const tokenizedTexts2 = lines2.map(line => tokenizeText(refineText(line)));
      vocabulary2 = new Set(tokenizedTexts2.flat());
      accumulatedData2 = lines2.slice(0, MAX_SENTENCES); // 최대 문장 수 제한 적용
      self.postMessage({ type: 'saveAccumulatedData2', data: accumulatedData2 });
      self.postMessage({ type: 'saveVocabulary2', data: Array.from(vocabulary2) });
      self.postMessage({
        type: 'log',
        message: \`vocabulary2에 저장된 단어 수: \${vocabulary2.size}개, 예시: \${Array.from(vocabulary2).slice(0, 20).join(', ')}\`
      });
      self.postMessage({
        type: 'log',
        message: \`accumulatedData2 초기값 (라인 수): \${accumulatedData2.length}\`
      });

      // 모델 초기화
      mlpSnnModel = new MLPSNN(300, 128, 64, 5, savedWeights);
      self.postMessage({ type: 'initComplete' });
    } catch (error) {
      self.postMessage({ type: 'initError', message: '초기화 중 오류 발생: ' + error.message });
    }
  }

  // 의도 식별
  function identifyIntent(text, useSecondVocab = false) {
    if (!mlpSnnModel) return 'unknown';
    const vector = wernickeArea(text, useSecondVocab);
    return mlpSnnModel.predict(vector);
  }

  // 파일저장2.txt를 주기적으로 읽고 의도 인식에 반영
  async function autoVectorizeAndSave() {
    if (!mlpSnnModel || !conversationHistory.length) return;

    conversationHistory.forEach(text => {
      const intent = identifyIntent(text);
      const vector = wernickeArea(text);
      prefrontalCortex(text, intent); // 파일저장2.txt에 저장 및 반영
    });
  }

  setInterval(autoVectorizeAndSave, 5000); // 5초마다 실행

  // 워커 메시지 처리
  self.onmessage = function(e) {
    const { type, text, apiKey, learningUrl, learningUrl2, savedWeights, initialData } = e.data;
    if (type === 'init') {
      loadData(apiKey, learningUrl, learningUrl2, savedWeights, initialData);
    } else if (type === 'process') {
      if (!mlpSnnModel) {
        self.postMessage({ type: 'processed', data: { intent: 'unknown', reply: '👾 챗봇: 초기화 중입니다. 잠시 기다려주세요.' } });
        return;
      }
      const intent = identifyIntent(text);
      const refinedIntent = prefrontalCortex(text, intent);
      const reply = brocaArea(refinedIntent);
      conversationHistory.push(text);
      self.postMessage({ type: 'saveConversationHistory', data: conversationHistory });
      mlpSnnModel.train(wernickeArea(text), refinedIntent);
      self.postMessage({ type: 'processed', data: { intent: refinedIntent, reply: "👾 챗봇: " + reply } });
    }
  };
`;

// 웹 워커 생성
const blob = new Blob([workerScript], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));

// 메시지 화면에 표시 함수
function appendBubble(text, sender) {
  const bubble = document.createElement('div');
  bubble.classList.add('bubble', sender);
  bubble.textContent = text;
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// 워커 메시지 수신 처리
worker.onmessage = function(e) {
  const { type, data, message, weights } = e.data;
  if (type === 'processed' && data) {
    appendBubble(data.reply, 'bot');
  } else if (type === 'saveWeights' && weights) {
    localStorage.setItem('modelWeights', JSON.stringify(weights));
  } else if (type === 'initError' && message) {
    appendBubble(`👾 챗봇: 초기화 오류 - ${message}`, 'bot');
  } else if (type === 'warning' && message) {
    appendBubble(`👾 챗봇: ${message}`, 'bot');
  } else if (type === 'initComplete') {
    isWorkerInitialized = true;
    appendBubble('안녕하세요! AI 챗봇입니다. 무엇을 도와드릴까요?', 'bot');
  } else if (type === 'log' && message) {
    console.log(message); // 실시간 로그 출력
  } else if (type === 'saveVocabulary') {
    localStorage.setItem('vocabulary', JSON.stringify(data));
  } else if (type === 'saveVocabulary2') {
    localStorage.setItem('vocabulary2', JSON.stringify(data));
  } else if (type === 'saveConversationHistory') {
    localStorage.setItem('conversationHistory', JSON.stringify(data));
  } else if (type === 'saveAccumulatedData2') {
    localStorage.setItem('accumulatedData2', JSON.stringify(data));
  }
};

// 메시지 처리 함수
function processMessage(text) {
  if (!text) return;
  appendBubble(text, 'user');
  if (!isWorkerInitialized) {
    appendBubble('👾 챗봇: 초기화 중입니다. 잠시 기다려주세요.', 'bot');
    return;
  }
  worker.postMessage({ type: 'process', text, apiKey: MY_API_KEY, learningUrl: LEARNING_TEXT_URL, learningUrl2: LEARNING_TEXT_URL_2 });
}

// 이벤트 리스너 설정
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

// 초기화 함수
(async function init() {
  const success = await fetchBackendData();
  if (success && MY_API_KEY && LEARNING_TEXT_URL && LEARNING_TEXT_URL_2) {
    const savedWeights = JSON.parse(localStorage.getItem('modelWeights') || 'null');
    const initialData = {
      vocabulary: JSON.parse(localStorage.getItem('vocabulary') || '[]'),
      vocabulary2: JSON.parse(localStorage.getItem('vocabulary2') || '[]'),
      conversationHistory: JSON.parse(localStorage.getItem('conversationHistory') || '[]'),
      accumulatedData2: JSON.parse(localStorage.getItem('accumulatedData2') || '[]')
    };
    worker.postMessage({
      type: 'init',
      apiKey: MY_API_KEY,
      learningUrl: LEARNING_TEXT_URL,
      learningUrl2: LEARNING_TEXT_URL_2,
      savedWeights,
      initialData
    });
  } else {
    appendBubble('👾 챗봇: 초기화 실패 - 백엔드 설정을 확인해주세요.', 'bot');
  }
})();
