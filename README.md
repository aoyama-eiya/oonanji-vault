# Oonanji Vault

<div align="center">
  <img src="https://github.com/aoyama-eiya/oonanji-vault/blob/main/system/public/android-chrome-512x512.png?raw=true" alt="Oonanji Vault Logo" width="120" />
</div>

<div align="center">

**Simple, Private, AI-Powered Workspace**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

---

## 📖 About

Oonanji Vault は、プライバシーと使いやすさを最優先に設計された、AI搭載のワークスペース・プラットフォームです。
ドキュメント管理、ファイルストレージ、そしてAIアシスタントを、シンプルで美しいインターフェースに統合しました。

### ✨ Key Concepts

- **Simplicity & Usability**
  - 複雑な設定は不要です。専門知識がなくても、直感的に使い始めることができます。

- **Privacy First**
  - あなたのデータは完全にあなたのものです。ローカル環境で動作し、学習目的で外部に送信されることはありません。外部AIモデルと比較しても、セキュリティ面で最も安全な選択肢の一つです。

- **Speed & Aesthetics**
  - 軽快な動作と、触れることが楽しくなるような洗練されたデザインを追求しました。思考を妨げない、スムーズな体験を提供します。

- **Focus on What Matters**
  - 過剰な機能は持たせず、本当に必要な機能だけを厳選。日々のタスクに集中できる環境を整えます。

---

## 🛠 Features

- **AI Secretary**: 文書作成から情報検索まで、あなたの業務をサポートするAIアシスタント。
- **Document Studio**: Markdownに対応した、クリーンで書きやすいドキュメントエディタ。
- **Secure Storage**: 重要なファイルを安全に保管・管理できるNAS機能。
- **Smart Indexing**: 保存した情報を自動で整理・インデックス化し、必要な時にすぐに呼び出せます。

---

## 🚀 Installation Guide

推奨環境: **Ubuntu Server / Desktop (22.04 LTS or later)**
インストール先: `/opt/oonanji-vault`

### 1. Prerequisites (事前準備)

Docker と Docker Compose がインストールされていない場合は、以下のコマンドでインストールしてください。

```bash
# Dockerのインストール
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 現在のユーザーをdockerグループに追加 (要再ログイン)
sudo usermod -aG docker $USER

# Dockerの起動確認
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. Download Project (ダウンロード)

プロジェクトを `/opt` ディレクトリ配下に展開します。

```bash
# /opt ディレクトリへ移動
cd /opt

# リポジトリのクローン (sudoが必要な場合があります)
sudo git clone https://github.com/aoyama-eiya/oonanji-vault.git

# 権限の調整 (現在のユーザーで使用できるように変更)
sudo chown -R $USER:$USER oonanji-vault

# ディレクトリへの移動
cd oonanji-vault/system
```

### 3. Setup AI Models (モデルの配置)

AI機能を動作させるために必要な学習済モデル（GGUF形式）をダウンロードし、配置します。

```bash
# modelsディレクトリの作成
mkdir -p models
cd models

# 1. LLM Model (Qwen2.5-3B-Instruct) のダウンロード
wget https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_0.gguf

# 2. Embedding Model (Nomic Embed Text) のダウンロード
wget https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.f16.gguf

# 元のディレクトリに戻る
cd ..
```

### 4. Start System (起動)

準備が完了したら、システムを起動します。

```bash
# 実行権限の付与
chmod +x start.sh

# システムの起動
./start.sh
```

初回起動時はコンテナのビルドが行われるため、数分〜数十分かかる場合があります。
完了後、ブラウザで以下のURLにアクセスしてください。

**http://localhost:3000**

---

## 💻 Manual Setup (Development)

開発者向けの手動セットアップ（Dockerを使用しない場合）です。

**Backend (Python/FastAPI)**
```bash
cd system
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python backend.py
```

**Frontend (Next.js)**
```bash
cd system
npm install
npm run dev
```

---

## 🤝 Contributing

Oonanji Vault はオープンソースプロジェクトです。
バグ報告、機能提案、プルリクエストなど、コミュニティからの貢献を歓迎します。

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## � Contact

ご質問、お問い合わせは以下のメールアドレスまでお願いいたします。

**Email**: aoyama@oonanji.com

---

## �📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <p>Made with ❤️ by the Oonanji Vault Team</p>
</div>
