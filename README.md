# Oonanji Vault - On-Premise LLM System (v1.0.0)
<img width="1920" height="1080" alt="local-AIAgent-Oonanji Vault" src="https://github.com/user-attachments/assets/45e8929a-64e8-4e5b-a212-d7b729be0d66" />


A secure, localhost-based on-premise LLM chat system with NAS search capabilities (RAG).
Designed for organizations to safely utilize internal data with zero external data transmission.

---

## Quick Start (Docker Recommended)

We recommend using **Docker** for deployment. Follow these steps to get started quickly.

### 1. Start

Run the following command in the project root directory:

```bash
docker compose up -d
```

This will start both frontend and backend containers in the background.

- **Frontend**: http://localhost (Port 80)
- **Backend API**: Port 8000 (Internal communication)
- **Default Login**: `adminuser` / `admin`

### 2. Stop

```bash
docker compose down
```

### 3. Initial Setup (Manual Build)

If you prefer to build the environment manually without Docker, please refer to [SETUP.md](./SETUP.md).

---

## License

"Oonanji Vault" is provided under the **Business Source License 1.1 (BSL 1.1)**.

### Terms of Use
1.  **Non-Commercial, Personal Use, Evaluation, Non-Production Environments**:
    *   **Free** to use.
    *   You may view, modify, and build the source code.
    *   Official update support and some portal integration features (e.g., auto-updates) may be limited.

2.  **Commercial Use (Production/Business Use)**:
    *   **Paid Commercial License** is required.
    *   This applies to internal business efficiency tools or service provision to customers.
    *   License holders receive automatic updates and support via authentication on the dedicated portal (oonanji-vault.com).

3.  **Change Date**:
    *   **January 1, 2030**
    *   After this date, the license will automatically convert to **Apache License 2.0** (Open Source).

* See [LICENSE](./LICENSE) for details.

### Third-Party Components
This system utilizes the following amazing open-source projects under their respective licenses:

*   **Llama.cpp** (MIT License): High-speed local LLM inference engine
*   **ChromaDB** (Apache 2.0): Vector database
*   **FastAPI** (MIT License): High-performance Python Python web framework
*   **Next.js** (MIT License): React framework
*   **Qwen2.5** (Apache 2.0 / Tongyi Qianwen License): High-performance foundation LLM model

---

## Key Features

### User Features
- **Secure AI Chat**: No external data transmission. Safe to use with internal regulations.
- **Integrated Knowledge Search (RAG)**: Automatically searches NAS and internal server documents (Word, Excel, PDF, etc.) and cites them in answers.
- **Canvas Mode**: A 2-pane interface specialized for coding and writing.
- **AI Model Management**: When an admin adds a model, it is automatically distributed to all users with isolated environments.

### Admin Features
- **User Management**: Centralized account management within the organization.
- **Index Management**: Vectorization of internal documents and database management.
- **System Updates**: OTA updates via portal integration (Commercial license only).
- **NAS Integration**: Utilize your organization's file server directly as a knowledge base.

---

## Directory Structure

```
oonanji-vault/
├── docker-compose.yml      # Docker configuration
├── system/
│   ├── backend.py          # FastAPI Backend
│   ├── models/             # Admin Model Storage (Git Ignored)
│   ├── models_*/           # User Model Storage (Auto-generated/Git Ignored)
│   ├── chroma_db/          # Vector DB Data
│   ├── users.db            # User Management DB
│   └── src/                # Next.js Frontend
└── README.md
```

## Notes
- **Model Files**: Large `.gguf` files in the `models/` directory are excluded from Git. You need to set them up separately.
- **Security**: Please change the default admin password (`admin`) immediately after the first login.

---

&copy; 2024-2026 Oonanji Vault Project. All rights reserved.
