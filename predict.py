import json
import torch
import torch.nn as nn
from collections import Counter
from torch.utils.data import DataLoader, TensorDataset

# 1. 어휘 사전 생성
def build_vocabulary(tokens):
    token_counts = Counter(tokens)
    vocab = {'<PAD>': 0, '<UNK>': 1}
    for token, _ in token_counts.most_common():
        if token not in vocab:
            vocab[token] = len(vocab)
    return vocab

# 2. 임베딩 매트릭스 생성
def create_embedding_matrix(vocab, embeddings_file='embeddings.json'):
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
    output_dim = 3
    model = LSTMClassifier(embedding_layer, hidden_dim, output_dim)
    
    # 학습 데이터 준비
    inputs = torch.tensor([[2, 3, 4], [5, 6, 7]])
    labels = torch.tensor([0, 1])
    dataset = TensorDataset(inputs, labels)
    train_loader = DataLoader(dataset, batch_size=2)
    
    # 학습
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    train_model(model, train_loader, criterion, optimizer, num_epochs=5)
    
    # 추론
    input_text = "안녕 하세요 저는 챗봇 입니다"
    predicted_class = predict(model, input_text, vocab)
    print("예측된 클래스:", predicted_class)
