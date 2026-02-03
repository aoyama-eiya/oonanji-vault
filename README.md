# Oonanji Vault - On-Premise LLM System (v1.0.3)

A secure, localhost-based on-premise LLM chat system with NAS search capabilities (RAG).
Designed for organizations to safely utilize internal data with zero external data transmission.

---

## 🚀 Quick Start (Deployment Guide)

For a smooth installation on Ubuntu, please follow these steps.

### 1. Prerequisites (Install Docker)

If Docker is not yet installed on your system, run the following:

```bash
# Download and install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Allow your user to run Docker
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Installation (Setup in /opt)

We recommend installing the system in the `/opt` directory, which is the standard location for optional software on Linux. You can jump directly to this directory from anywhere using an absolute path.

```bash
# 1. Move to the /opt directory (no matter where you are)
cd /opt

# 2. Grant your user permission to write in /opt (required for cloning)
sudo chown $USER:$USER /opt

# 3. Clone the repository
git clone https://github.com/aoyama-eiya/oonanji-vault.git

# 4. Enter the project folder
cd /opt/oonanji-vault

# Note: If the folder name became 'oonanji-vault-main' (from ZIP download):
# mv /opt/oonanji-vault-main /opt/oonanji-vault && cd /opt/oonanji-vault
```

### 3. Download AI Models

The system requires AI models to function. Download them into the `system/models` directory.

```bash
cd /opt/oonanji-vault/system/models

# Download Embedding Model (Nomic Embed)
curl -L -o nomic-embed-text-v1.5.f16.gguf https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.f16.gguf

# Download LLM (Qwen 2.5 3B)
curl -L -o qwen2.5-3b-instruct-q4_0.gguf https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_0.gguf
```

### 4. Startup (from /system directory)

Go to the `system` directory and start the system with Docker:

```bash
cd /opt/oonanji-vault/system
docker compose up -d
```

Valid startup output:
- `Container oonanji-backend Created`
- `Container oonanji-frontend Created`

### 5. Configure Auto-Start (Optional)

To ensure the system starts automatically when the PC boots:

```bash
docker update --restart unless-stopped oonanji-backend
docker update --restart unless-stopped oonanji-frontend
```

---

## 🔐 Login

- **URL**: http://localhost
- **Default ID**: `adminuser`
- **Default Password**: `admin`

*The system automatically creates this administrator account on the first launch if no database is found.*

---

## 🛠 GPU Support (Optional)

By default, the system runs on **CPU/Integrated GPU**. If you have an **NVIDIA GPU**:

1. Open `system/Dockerfile.backend` and follow the comments to switch to the NVIDIA base image.
2. Open `system/docker-compose.yml` and uncomment the `deploy` section.

---

## Directory Structure

```
oonanji-vault/
├── README.md
├── INSTALL.md
└── system/                 # Main System Files
    ├── docker-compose.yml  # Run Docker from here
    ├── backend.py          # FastAPI Backend
    ├── models/             # AI Models
    └── src/                # Next.js Frontend
```

---

&copy; 2024-2026 Oonanji Vault Project. All rights reserved.
