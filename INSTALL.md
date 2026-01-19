# Oonanji Vault Installation Guide (for Ubuntu)

This guide explains how to install Oonanji Vault on a new Ubuntu PC.

## 1. Prerequisites

- **OS**: Ubuntu 22.04 LTS or 24.04 LTS
- **Hardware**:
  - Memory: 16GB+ recommended
  - GPU: NVIDIA GPU (Optional, for performance) or CPU/Integrated GPU
- **Internet**: Required for initial setup

---

## 2. Installation Steps (Docker Recommended)

### Step 1: Install Docker (If not installed)

```bash
# Run Docker official installation script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to Docker group
sudo usermod -aG docker $USER
# Apply changes
newgrp docker
```

### Step 2: Clone and Setup Directory

The system is designed to run from `/opt/oonanji-vault`.

```bash
# Create directory and clone
sudo mkdir -p /opt
sudo chown $USER:$USER /opt
cd /opt

# Ensure the directory name is 'oonanji-vault'
git clone https://github.com/aoyama-eiya/oonanji-vault.git
cd oonanji-vault
```

### Step 3: Configure for NVIDIA GPU (Optional)

By default, the system runs on **CPU/Integrated GPU**. If you have an **NVIDIA GPU**, follow these steps:

1.  Edit `system/Dockerfile.backend`:
    - Uncomment `FROM nvidia/cuda:12.2.2-devel-ubuntu22.04`
    - Comment out `FROM ubuntu:22.04`
    - Uncomment the GPU-specific installation lines for `llama-cpp-python`.
2.  Edit `docker-compose.yml`:
    - Uncomment the `deploy` section under the `backend` service.

### Step 4: Start the System

Run this command from the `/opt/oonanji-vault` directory:

```bash
docker compose up -d
```

Valid startup output should show:
- `Network oonanji-vault_default Created`
- `Container oonanji-backend Created`
- `Container oonanji-frontend Created`

---

## 3. Initial Login

- **URL**: `http://localhost`
- **Default ID**: `adminuser`
- **Default Password**: `admin`

If the database is not found, the system creates this administrator account automatically on the first startup.

---

## 4. Troubleshooting

### Login Failure
If you cannot login, check the logs:
```bash
docker logs oonanji-backend
```
Ensure you see "Created default admin user" in the logs if it's the first run.

### Directory Name
If you downloaded the code as a ZIP and it's named `oonanji-vault-main`, rename it:
```bash
mv oonanji-vault-main oonanji-vault
```

### Automatic Startup (Ubuntu)
To make the system start automatically when Ubuntu boots:
```bash
docker update --restart unless-stopped oonanji-backend
docker update --restart unless-stopped oonanji-frontend
```
