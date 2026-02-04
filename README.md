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

## 🚀 Getting Started

Oonanji Vault は、Docker を使用して簡単にセットアップできます。

### Prerequisites

- Docker
- Docker Compose

### Installation

1. **リポジトリのクローン**
   ```bash
   git clone https://github.com/aoyama-eiya/oonanji-vault.git
   cd oonanji-vault
   ```

2. **起動**
   ```bash
   chmod +x start.sh
   ./start.sh
   ```
   初回起動時は必要なイメージのビルドやダウンロードが行われます。

3. **アクセス**
   ブラウザで `http://localhost:3000` にアクセスしてください。

### Manual Setup (Development)

開発者向けの手動セットアップ手順です。

1. **Backend (Python/FastAPI)**
   ```bash
   cd system
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python backend.py
   ```

2. **Frontend (Next.js)**
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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <p>Made with ❤️ by the Oonanji Vault Team</p>
</div>
