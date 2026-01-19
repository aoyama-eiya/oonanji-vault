# Oonanji Vault - On-Premise LLM System (v1.0.0)

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

### 2. Installation (Clone to /opt)

We recommend installing the system in the `/opt` directory.

```bash
# Setup directory
sudo mkdir -p /opt
sudo chown $USER:$USER /opt
cd /opt

# Clone the repository
git clone https://github.com/aoyama-eiya/oonanji-vault.git
cd oonanji-vault

# Note: If your folder is named 'oonanji-vault-main', please rename it:
# mv oonanji-vault-main oonanji-vault
```

### 3. Startup (from /system directory)

Inside the `system` folder, start the containers:

```bash
cd /opt/oonanji-vault/system
docker compose up -d
```

Valid startup output:
- `Container oonanji-backend Created`
- `Container oonanji-frontend Created`

### 4. Configure Auto-Start (Optional)

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
