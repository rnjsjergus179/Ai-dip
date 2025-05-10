const fetch = require('node-fetch');

// 학습 데이터 URL (예시)
const LEARNING_TEXT_URL = 'https://raw.githubusercontent.com/rnjsjergus179/-/main/학습용.txt';

// 의도별 키워드 정의 (간단한 예시)
const INTENT_KEYWORDS = {
  greeting: ['안녕', '하이', '반가워'],
  question: ['무엇', '어떻게', '왜'],
  request: ['부탁', '요청', '해줘'],
  science: ['과학', '물리', '실험'],
  unknown: []
};

// 의도별 응답 템플릿
const RESPONSES = {
  greeting: ['안녕하세요!', '반갑습니다!', '안녕!'],
  question: ['질문에 대한 답변을 준비 중입니다.', '곧 답변드리겠습니다.'],
  request: ['요청을 처리 중입니다.', '곧 도와드리겠습니다!'],
  science: ['과학 관련 질문이군요!', '흥미로운 주제입니다!'],
  unknown: ['죄송합니다, 이해하지 못했습니다.']
};

/** 텍스트 정제 함수 */
function refineText(text) {
  return text.replace(/[^가-힣a-zA-Z0-9\s]/g, '').toLowerCase().trim();
}

/** 텍스트 토큰화 함수 */
function tokenizeText(text) {
  return text.split(/\s+/).filter(word => word.length > 0);
}

/** 어휘 생성 함수 */
async function buildVocabulary() {
  try {
    const response = await fetch(LEARNING_TEXT_URL);
    if (!response.ok) throw new Error('데이터를 가져오지 못했습니다.');
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    const allTokens = lines.map(line => tokenizeText(refineText(line))).flat();
    return [...new Set(allTokens)]; // 고유 단어 집합 반환
  } catch (error) {
    throw new Error('어휘 생성 중 오류 발생: ' + error.message);
  }
}

/** Bag-of-Words 백터화 함수 */
function vectorizeText(tokens, vocab) {
  const vector = new Array(vocab.length).fill(0);
  tokens.forEach(token => {
    const index = vocab.indexOf(token);
    if (index >= 0) vector[index] += 1;
  });
  return vector;
}

/** 의도 식별 함수 */
function identifyIntent(text, vocab) {
  const refinedText = refineText(text);
  const tokens = tokenizeText(refinedText);
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (tokens.some(token => keywords.includes(token))) {
      return intent;
    }
  }
  return 'unknown';
}

/** 응답 생성 함수 */
function generateResponse(intent) {
  const responseList = RESPONSES[intent] || RESPONSES['unknown'];
  return responseList[Math.floor(Math.random() * responseList.length)];
}

/** 클라이언트 요청 처리 함수 */
async function processClientRequest(text) {
  const vocab = await buildVocabulary(); // 어휘 생성
  const intent = identifyIntent(text, vocab); // 의도 식별
  const response = generateResponse(intent); // 응답 생성
  return { intent, response }; // 결과 반환
}

// 모듈 내보내기
module.exports = { processClientRequest };
