import json
import torch
import torch.nn as nn
from collections import Counter
from torch.utils.data import DataLoader, TensorDataset

# 1. 어휘 사전 생성
def build_vocabulary(tokens):
    """
    MongoDB에서 가져온 토큰 리스트를 기반으로 어휘 사전을 생성합니다.
    
    Args:
        tokens (list): 토큰 리스트
    Returns:
        dict: 단어를 정수 인덱스로 매핑한 어휘 사전
    """
    token_counts = Counter(tokens)
    vocab = {'<PAD>': 0, '<UNK>': 1}
    for token, _ in token_counts.most_common():
        if token not in vocab:
            vocab[token] = len(vocab)
    return vocab

# 2. 임베딩 매트릭스 생성
def create_embedding_matrix(vocab, embeddings_file='embeddings.json'):
    """
    embeddings.json 파일을 기반으로 임베딩 매트릭스를 생성합니다.
    
    Args:
        vocab (dict): 어휘 사전
        embeddings_file (str): 사전 학습된 임베딩 파일 경로
    Returns:
        torch.Tensor: 임베딩 매트릭스
    """
    with open(embeddings_file, 'r') as f:
        embeddings = json.load(f)
    embedding_dim = len(next(iter(embeddings.values())))
    vocab_size = len(vocab)
    embedding_matrix = torch.zeros((vocab_size, embedding_dim))
    for word, idx in vocab.items():
        if word in embeddings:
            embedding_matrix[idx] = torch.tensor(embeddings[word])
        else:
            embedding_matrix[idx] = torch.randn(embedding_dim)
    return embedding_matrix

# 3. 모델 정의
class LSTMClassifier(nn.Module):
    def __init__(self, embedding_layer, hidden_dim, output_dim):
        super(LSTMClassifier, self).__init__()
        self.embedding = embedding_layer
        self.lstm = nn.LSTM(embedding_layer.embedding_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, output_dim)
        self.softmax = nn.Softmax(dim=1)
    
    def forward(self, x):
        embedded = self.embedding(x)
        lstm_out, _ = self.lstm(embedded)
        last_output = lstm_out[:, -1, :]
        logits = self.fc(last_output)
        return self.softmax(logits)

# 4. 학습 루프
def train_model(model, train_loader, criterion, optimizer, num_epochs):
    """
    모델을 학습시키는 함수입니다.
    
    Args:
        model: 학습할 모델
        train_loader: 학습 데이터 로더
        criterion: 손실 함수
        optimizer: 최적화 알고리즘
        num_epochs: 학습 에포크 수
    """
    for epoch in range(num_epochs):
        model.train()
        total_loss = 0
        for inputs, labels in train_loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        print(f'Epoch {epoch+1}/{num_epochs}, Loss: {total_loss / len(train_loader)}')

# 5. 실시간 추론
def predict(model, input_text, vocab):
    """
    입력 텍스트에 대해 모델의 예측을 수행합니다.
    
    Args:
        model: 학습된 모델
        input_text (str): 예측할 입력 텍스트
        vocab (dict): 어휘 사전
    Returns:
        int: 예측된 클래스 인덱스
    """
    model.eval()
    tokens = input_text.split()
    indices = [vocab.get(token, vocab['<UNK>']) for token in tokens]
    input_tensor = torch.tensor(indices).unsqueeze(0)
    with torch.no_grad():
        output = model(input_tensor)
    predicted_class = torch.argmax(output, dim=1).item()
    return predicted_class

# 실행 예시
if __name__ == "__main__":
    # 데이터 준비
    sample_tokens = ['안녕', '하세요', '저는', '챗봇', '입니다', '안녕', '하세요']
    vocab = build_vocabulary(sample_tokens)
    embedding_matrix = create_embedding_matrix(vocab)
    embedding_layer = nn.Embedding.from_pretrained(embedding_matrix, freeze=False)
    
    # 모델 초기화
    hidden_dim = 128
    output_dim = 3  # 예: 긍정(0), 부정(1), 중립(2)
    model = LSTMClassifier(embedding_layer, hidden_dim, output_dim)
    
    # 학습 데이터 준비 (예시 데이터)
    inputs = torch.tensor([[2, 3, 4], [5, 6, 7]])  # '저는 챗봇 입니다', '안녕 하세요 안녕'에 대응
    labels = torch.tensor([0, 1])  # 예시 레이블: 긍정(0), 부정(1)
    dataset = TensorDataset(inputs, labels)
    train_loader = DataLoader(dataset, batch_size=2)
    
    # 학습
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    train_model(model, train_loader, criterion, optimizer, num_epochs=5)
    
    # 추론
    input_text = "안녕 하세요 저는 챗봇 입니다"
    predicted_class = predict(model, input_text, vocab)
    
    # 결과 출력
    responses = {0: "긍정", 1: "부정", 2: "중립"}
    response = responses.get(predicted_class, "알 수 없음")
    print(f"예측된 클래스: {predicted_class} ({response})")
