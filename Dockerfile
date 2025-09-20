FROM python:3.10.12-slim

WORKDIR /app

# システムパッケージのインストール
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python依存関係のインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションファイルのコピー
COPY . .

# 不要なファイルを削除
RUN rm -rf .git .gitignore README.md

# ポートの公開
EXPOSE 5000

# アプリケーションの実行
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "app:app"]
