import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from collections import Counter
from flask import Flask, request, jsonify
import requests  # MongoDB API 호출을 위해 추가

app = Flask(__name__)

# MongoDB Atlas Data API 설정 (사용자가 실제 값으로 변경 필요)
MONGO_API_URL = 'https://data.mongodb-api.com/app/your-app-id/endpoint/data'  # 실제 URL로 변경
MONGO_API_KEY = 'your-mongo-api-key'  # 실제 API 키로 변경

# 설정
VOCAB_MIN_FREQ = 5  # 단어장 구축: 최소 등장 횟수
EMBEDDING_JSON = 'embeddings.json'  # 임베딩 매트릭스 파일 경로
EMBEDDING_DIM = 100  # 임베딩 벡터 차원
HIDDEN_DIM = 128
OUTPUT_DIM = 4  # 레이블 수 (긍정, 부정, 중립, 질문)
BATCH_SIZE = 32
EPOCHS = 10

# 사용자의 홈페이지 URL
USER_HOMEPAGE = 'https://rnjsjergus179.github.io/-/'

# 2. 단어장 구축
def build_vocabulary(tokens):
    token_counts = Counter(tokens)
    vocab = {token: idx + 2 for idx, (token, count) in enumerate(token_counts.items()) if count >= VOCAB_MIN_FREQ}
    vocab['<PAD>'] = 0  # 패딩 토큰
    vocab['<UNK>'] = 1  # 알 수 없는 토큰
    return vocab

# 3. 임베딩 매트릭스 로딩
def load_embedding_matrix(vocab):
    with open(EMBEDDING_JSON, 'r', encoding='utf-8') as f:
        embeddings = json.load(f)
    
    embedding_matrix = torch.zeros((len(vocab), EMBEDDING_DIM))
    for token, idx in vocab.items():
        if token in embeddings:
            embedding_matrix[idx] = torch.tensor(embeddings[token])
        else:
            embedding_matrix[idx] = torch.randn(EMBEDDING_DIM)  # 랜덤 초기화
    return embedding_matrix

# 4. PyTorch Dataset: 문서-레이블 쌍을 인덱스 시퀀스로 변환
class TextDataset(Dataset):
    def __init__(self, texts, labels, vocab):
        self.texts = texts
        self.labels = labels
        self.vocab = vocab

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = self.texts[idx]
        label = self.labels[idx]
        sequence = [self.vocab.get(token, self.vocab['<UNK>']) for token in text.split()]
        return torch.tensor(sequence), torch.tensor(label)

# 5. LSTM 분류기: 사전 학습 임베딩 + 양방향 LSTM + FC
class LSTMClassifier(nn.Module):
    def __init__(self, embedding_matrix, hidden_dim, output_dim):
        super(LSTMClassifier, self).__init__()
        vocab_size, embedding_dim = embedding_matrix.size()
        self.embedding = nn.Embedding.from_pretrained(embedding_matrix, freeze=False)
        self.lstm = nn.LSTM(embedding_dim, hidden_dim, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_dim * 2, output_dim)  # 양방향이므로 hidden_dim * 2

    def forward(self, text):
        embedded = self.embedding(text)
        output, (hidden, cell) = self.lstm(embedded)
        hidden = torch.cat((hidden[-2,:,:], hidden[-1,:,:]), dim=1)  # 양방향 hidden 상태 결합
        return self.fc(hidden)

# 데이터 준비 (예시)
texts = ["안녕하세요 좋은 날입니다", "날씨가 너무 춥네요", "이름이 뭐예요", "감사합니다 잘 돼요"]  # 예시 데이터
labels = [0, 1, 2, 0]  # 예: 0=긍정, 1=부정, 2=질문, 3=기타
tokens = [text.split() for text in texts]
all_tokens = [token for sublist in tokens for token in sublist]
vocab = build_vocabulary(all_tokens)
embedding_matrix = load_embedding_matrix(vocab)

# Dataset 및 DataLoader 생성
dataset = TextDataset(texts, labels, vocab)
loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True, collate_fn=lambda x: zip(*x))

# 모델, 손실 함수, 옵티마이저, 스케줄러 초기화
model = LSTMClassifier(embedding_matrix, HIDDEN_DIM, OUTPUT_DIM)
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)
scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=5, gamma=0.1)

# 6. 학습 루프
def train_model(model, loader, epochs):
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for texts, labels in loader:
            texts = nn.utils.rnn.pad_sequence(texts, batch_first=True, padding_value=vocab['<PAD>'])
            optimizer.zero_grad()
            predictions = model(texts)
            loss = criterion(predictions, labels)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        
        scheduler.step()
        print(f'Epoch {epoch+1}/{epochs}, Loss: {total_loss/len(loader):.4f}')
        
        # 검증 정확도
        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for texts, labels in loader:
                texts = nn.utils.rnn.pad_sequence(texts, batch_first=True, padding_value=vocab['<PAD>'])
                predictions = model(texts)
                _, predicted = torch.max(predictions, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
        accuracy = 100 * correct / total
        print(f'Validation Accuracy: {accuracy:.2f}%')

# 학습 실행
train_model(model, loader, EPOCHS)

# 추론 함수
def predict(model, text, vocab):
    model.eval()
    with torch.no_grad():
        sequence = torch.tensor([vocab.get(token, vocab['<UNK>']) for token in text.split()]).unsqueeze(0)
        prediction = model(sequence)
        _, predicted = torch.max(prediction, 1)
        responses = {
            0: f"좋은 말씀 감사합니다! 제 홈페이지를 방문해보세요: {USER_HOMEPAGE}",
            1: "아쉽네요, 어떻게 도와드릴까요?",
            2: "궁금한 점을 말씀해 주세요!",
            3: "별말씀을요!"
        }
        return responses.get(predicted.item(), "잘 이해하지 못했어요.")

# MongoDB에서 tokens 가져오는 함수
def fetch_mongo_tokens():
    try:
        headers = {
            'Content-Type': 'application/json',
            'api-key': MONGO_API_KEY
        }
        body = {
            'collection': 'your-collection',  # 실제 컬렉션 이름으로 변경
            'database': 'your-database',      # 실제 데이터베이스 이름으로 변경
            'dataSource': 'your-cluster',     # 실제 클러스터 이름으로 변경
            'filter': {},                     # 필요 시 필터 추가
            'projection': {'tokens': 1}
        }
        response = requests.post(MONGO_API_URL, headers=headers, json=body)
        data = response.json()
        return data.get('documents', [{}])[0].get('tokens', [])
    except Exception as e:
        print(f'MongoDB API 호출 실패: {e}')
        return []

# Flask 엔드포인트: MongoDB tokens 가져오기
@app.route('/mongo-tokens', methods=['GET'])
def get_mongo_tokens():
    tokens = fetch_mongo_tokens()
    return jsonify({'tokens': tokens})

# Flask 엔드포인트: 챗봇 응답
@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    message = data['message']
    response = predict(model, message, vocab)
    tokens = fetch_mongo_tokens()  # MongoDB 데이터 호출
    # 필요 시 tokens를 응답에 활용하는 로직 추가 가능
    return jsonify({'response': response, 'mongo_tokens': tokens})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
