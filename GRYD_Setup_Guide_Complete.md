# GRYD Platform
## Complete Setup & Deployment Guide

---

**Document Version:** 1.0
**Date:** January 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Choose Your Plan](#2-choose-your-plan)
3. [Required Accounts & Services](#3-required-accounts--services)
4. [Environment Configuration](#4-environment-configuration)
5. [Deployment Options](#5-deployment-options)
6. [Post-Deployment Setup](#6-post-deployment-setup)
7. [Quick Reference](#7-quick-reference)

---

## 1. Introduction

Welcome to the GRYD Platform setup guide. This document will walk you through setting up your own production environment with all required services and configurations.

### What You'll Set Up

| Component | Service | Purpose |
|-----------|---------|---------|
| Database | MongoDB Atlas | Store users, messages, communities |
| File Storage | Cloudinary | Images, profile pics, uploads |
| Voice/Video | Agora | Real-time calls |
| Email | Brevo | Invitations, OTP codes |
| Frontend Hosting | Vercel | Web application |
| Backend Hosting | DigitalOcean or AWS | API server |

---

## 2. Choose Your Plan

### Pricing Tiers Overview

| Tier | Members | Monthly Cost | Annual Cost | Best For |
|------|---------|--------------|-------------|----------|
| **Starter** | < 500 | $0-20 | $0-240 | Testing, pilot programs |
| **Growth** | 500-2,500 | $113 | $1,356 | Small credit unions |
| **Professional** | 2,500-10,000 | $280-370 | $3,360-4,440 | Growing organizations |
| **Enterprise** | 10,000+ | $958+ | $11,496+ | Large organizations |

---

### Tier 1: Starter (Free/Low Cost)

**Best for:** Testing, development, pilot programs with < 500 members

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| MongoDB Atlas | M0 (Free) | $0 |
| Cloudinary | Free | $0 |
| Agora | Free (10K mins) | $0 |
| Brevo | Free (300/day) | $0 |
| Vercel | Hobby (Free) | $0 |
| Backend | Render (Free) | $0 |
| **TOTAL** | | **$0/mo** |

⚠️ **Limitations:**
- Backend sleeps after 15 min inactivity (slow first request)
- 512MB database storage
- 25GB media storage
- No SLA guarantee

---

### Tier 2: Growth

**Best for:** Active communities with 500-2,500 members

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| MongoDB Atlas | M5 (5GB) | $25 |
| Cloudinary | Free | $0 |
| Agora | Pay-as-you-go | ~$30 |
| Brevo | Starter (20K emails) | $25 |
| Vercel | Pro | $20 |
| Backend | DigitalOcean 2GB | $12 |
| **TOTAL** | | **$112/mo** |

✅ **Benefits:**
- Always-on backend (no sleep)
- 5GB database storage
- Professional email delivery
- Reliable for daily active use

---

### Tier 3: Professional

**Best for:** Growing organizations with 2,500-10,000 members

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| MongoDB Atlas | M10 (10GB, dedicated) | $57 |
| Cloudinary | Plus (225GB) | $99 |
| Agora | Pay-as-you-go | ~$100 |
| Brevo | Business (50K emails) | $65 |
| Vercel | Pro | $20 |
| Backend | DigitalOcean 4GB | $24 |
| Backups | DigitalOcean | $5 |
| **TOTAL** | | **$370/mo** |

✅ **Benefits:**
- Dedicated database resources
- High-capacity media storage
- Full email automation
- Daily automated backups
- Production-ready performance

---

### Tier 4: Enterprise

**Best for:** Large organizations with 10,000+ members

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| MongoDB Atlas | M20 (20GB, 4GB RAM) | $140 |
| Cloudinary | Advanced (900GB) | $249 |
| Agora | Pay-as-you-go | ~$300 |
| Brevo | Enterprise (100K+) | $100 |
| Vercel | Pro | $20 |
| Backend | DigitalOcean 8GB + LB | $108 |
| Backups | DigitalOcean | $20 |
| Monitoring | Additional | $20 |
| **TOTAL** | | **$957/mo** |

✅ **Benefits:**
- Load-balanced infrastructure
- High-availability setup
- Enterprise-grade database
- Advanced monitoring & alerts

---

## 3. Required Accounts & Services

### 3.1 MongoDB Atlas (Database)

**Website:** [mongodb.com/atlas](https://mongodb.com/atlas)

**Setup Steps:**

1. **Create Account**
   - Go to mongodb.com/atlas
   - Click "Try Free"
   - Sign up with email or Google

2. **Create Project**
   - Name: "GRYD Production"

3. **Create Cluster**
   - Click "Build a Database"
   - Select tier based on your plan:
     | Plan | Tier | Cost |
     |------|------|------|
     | Starter | M0 (Free) | $0 |
     | Growth | M5 | $25/mo |
     | Professional | M10 | $57/mo |
     | Enterprise | M20 | $140/mo |
   - Select region closest to your users
   - Click "Create"

4. **Create Database User**
   - Go to "Database Access" → "Add New Database User"
   - Authentication: Password
   - Username: `gryd_admin` (example)
   - Password: Generate or create strong password
   - Role: "Read and write to any database"
   - Click "Add User"
   - **⚠️ SAVE THESE CREDENTIALS!**

5. **Configure Network Access**
   - Go to "Network Access" → "Add IP Address"
   - For development: "Allow Access from Anywhere" (0.0.0.0/0)
   - For production: Add your server's specific IP

6. **Get Connection String**
   - Go to "Database" → "Connect"
   - Select "Connect your application"
   - Driver: Node.js, Version: 5.5 or later
   - Copy connection string

**Your connection string:**
```
mongodb+srv://gryd_admin:<password>@cluster0.xxxxx.mongodb.net/gryd?retryWrites=true&w=majority
```
Replace `<password>` with your actual password.

---

### 3.2 Cloudinary (Media Storage)

**Website:** [cloudinary.com](https://cloudinary.com)

**Setup Steps:**

1. **Create Account**
   - Go to cloudinary.com
   - Click "Sign Up For Free"
   - Complete registration

2. **Get Credentials**
   - Go to Dashboard (automatic after signup)
   - Find and copy:
     - **Cloud Name:** `xxxxxxxxx`
     - **API Key:** `123456789012345`
     - **API Secret:** `abcdefghijklmnopqrstuvwx`

**Pricing:**
| Plan | Storage | Bandwidth | Cost |
|------|---------|-----------|------|
| Free | 25GB | 25GB/mo | $0 |
| Plus | 225GB | 225GB/mo | $99/mo |
| Advanced | 900GB | 900GB/mo | $249/mo |

---

### 3.3 Agora (Voice & Video Calls)

**Website:** [agora.io](https://agora.io)

**Setup Steps:**

1. **Create Account**
   - Go to agora.io
   - Click "Sign Up"
   - Verify email

2. **Create Project**
   - Go to Console → Project Management
   - Click "Create New Project"
   - Project Name: "GRYD"
   - Authentication: "Secured mode: APP ID + Token"
   - Click "Submit"

3. **Get Credentials**
   - Click on your project
   - Copy:
     - **App ID:** `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
     - **App Certificate:** Click "Enable" if needed, then copy

**Pricing:**
| Service | Free Tier | After Free |
|---------|-----------|------------|
| Audio | 10,000 mins/mo | $0.99/1000 mins |
| Video (720p) | 10,000 mins/mo | $3.99/1000 mins |
| Video (1080p) | 10,000 mins/mo | $8.99/1000 mins |

---

### 3.4 Brevo (Email Service)

**Website:** [brevo.com](https://brevo.com)

**Setup Steps:**

1. **Create Account**
   - Go to brevo.com
   - Click "Sign Up Free"
   - Complete registration
   - Verify your email

2. **Get API Key**
   - Go to SMTP & API → API Keys
   - Click "Generate a new API key"
   - Name: "GRYD Production"
   - Copy the API key

3. **Verify Sender Email**
   - Go to Senders & IP → Senders
   - Add your sending email address
   - Verify it via the confirmation email

**Pricing:**
| Plan | Emails/Month | Cost |
|------|--------------|------|
| Free | 300/day (~9K/mo) | $0 |
| Starter | 20,000 | $25/mo |
| Business | 50,000 | $65/mo |
| Enterprise | 100,000+ | Custom |

---

### 3.5 Generate JWT Secret

**What it does:** Secures user authentication

**How to Generate:**

Option 1 - Terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Option 2 - Online:
- Go to [randomkeygen.com](https://randomkeygen.com)
- Copy a "CodeIgniter Encryption Key" or similar

**Example:**
```
7f3d8a2b1c4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2
```

**⚠️ IMPORTANT:** Keep this secret SAFE. Never share publicly!

---

## 4. Environment Configuration

### 4.1 Backend Environment Variables (.env)

Create a `.env` file in your backend directory with:

```env
# ============================================
# GRYD PLATFORM - PRODUCTION CONFIGURATION
# ============================================

# Server Port
PORT=3000

# ============================================
# DATABASE - MongoDB Atlas
# ============================================
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/gryd?retryWrites=true&w=majority

# ============================================
# AUTHENTICATION
# ============================================
JWT_SECRET=YOUR_64_CHARACTER_SECRET_HERE

# ============================================
# EMAIL SERVICE - Brevo
# ============================================
BREVO_API_KEY=xkeysib-your-api-key-here
EMAIL_FROM_ADDRESS=noreply@yourcompany.com
EMAIL_FROM_NAME=GRYD Platform
SKIP_BREVO_IP_CHECK=false

# ============================================
# FILE STORAGE - Cloudinary
# ============================================
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# ============================================
# VOICE/VIDEO CALLS - Agora
# ============================================
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-certificate

# ============================================
# APPLICATION URLs
# ============================================
PUBLIC_APP_URL=https://your-frontend-domain.com
```

### 4.2 Frontend Environment Variable

For Vercel deployment, add this environment variable:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-backend-domain.com
```

---

## 5. Deployment Options

Choose your backend hosting platform. Both are excellent choices with different tradeoffs.

### DigitalOcean vs AWS Comparison

| Aspect | DigitalOcean | AWS |
|--------|--------------|-----|
| **Ease of Use** | ⭐⭐⭐⭐⭐ Very Easy | ⭐⭐⭐ Complex |
| **Pricing** | Simple, predictable | Complex, can vary |
| **Learning Curve** | 1-2 days | 1-2 weeks |
| **Setup Time** | 30 minutes | 1-2 hours |
| **Control Panel** | Clean, intuitive | Feature-rich, overwhelming |
| **Support** | Good | Excellent (paid) |
| **Global Reach** | 15 regions | 30+ regions |
| **Scaling** | Manual/simple | Auto-scaling available |
| **Best For** | Startups, small-medium | Enterprise, complex needs |

### Cost Comparison (Same Specs: 4GB RAM, 2 vCPU)

| Provider | Service | Monthly Cost |
|----------|---------|--------------|
| DigitalOcean | Droplet | $24/mo |
| AWS | EC2 t3.medium | $30-35/mo |

---

### Option A: DigitalOcean Deployment

**Recommended for:** Most users, simpler setup, predictable pricing

#### Step 1: Create DigitalOcean Account

1. Go to [digitalocean.com](https://digitalocean.com)
2. Sign up (get $200 free credit with referral links)
3. Add payment method

#### Step 2: Create Droplet (Server)

1. Click "Create" → "Droplets"
2. **Choose Region:** Closest to your users
3. **Choose Image:** Ubuntu 22.04 LTS
4. **Choose Size:**
   | Plan | Size | Cost | Members |
   |------|------|------|---------|
   | Growth | 2GB RAM, 1 vCPU | $12/mo | 500-2,500 |
   | Professional | 4GB RAM, 2 vCPU | $24/mo | 2,500-10,000 |
   | Enterprise | 8GB RAM, 4 vCPU | $48/mo | 10,000+ |
5. **Authentication:** SSH Key (recommended) or Password
6. **Hostname:** `gryd-production`
7. Click "Create Droplet"

#### Step 3: Connect to Server

```bash
# Using SSH (replace with your server IP)
ssh root@YOUR_SERVER_IP

# If using password, enter it when prompted
```

#### Step 4: Install Required Software

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx (web server)
apt install -y nginx

# Install Git
apt install -y git
```

#### Step 5: Clone and Setup Application

```bash
# Navigate to home directory
cd /root

# Clone your repository
git clone https://github.com/YOUR_USERNAME/gryd.git

# Navigate to backend
cd gryd/backend/api-gateway

# Install dependencies
npm install

# Create environment file
nano .env
```

Paste your environment variables (from Section 4.1), then save:
- Press `Ctrl + X`
- Press `Y` to confirm
- Press `Enter` to save

#### Step 6: Start Application with PM2

```bash
# Start the application
pm2 start src/index.js --name gryd-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on reboot
pm2 startup
# Copy and run the command it outputs

# Verify it's running
pm2 status
```

#### Step 7: Configure Nginx

```bash
# Create Nginx configuration
nano /etc/nginx/sites-available/gryd
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Increase max upload size for file uploads
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout settings for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Save and enable:

```bash
# Create symbolic link
ln -s /etc/nginx/sites-available/gryd /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl enable nginx
```

#### Step 8: Add SSL Certificate (HTTPS)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
certbot --nginx -d your-domain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose redirect option (recommended)

# Auto-renewal is configured automatically
# Test it with:
certbot renew --dry-run
```

#### Step 9: Configure Firewall

```bash
# Enable UFW firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# Verify
ufw status
```

**Your backend is now live at:** `https://your-domain.com`

---

### Option B: AWS Deployment

**Recommended for:** Enterprise users, those already using AWS, need for auto-scaling

#### Step 1: Create AWS Account

1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Complete registration
4. Add payment method

#### Step 2: Launch EC2 Instance

1. Go to EC2 Dashboard → "Launch Instance"
2. **Name:** `gryd-production`
3. **AMI:** Ubuntu Server 22.04 LTS
4. **Instance Type:**
   | Plan | Type | vCPU | RAM | Cost |
   |------|------|------|-----|------|
   | Growth | t3.small | 2 | 2GB | ~$15/mo |
   | Professional | t3.medium | 2 | 4GB | ~$30/mo |
   | Enterprise | t3.large | 2 | 8GB | ~$60/mo |
5. **Key Pair:** Create new or use existing
6. **Security Group:** Create new with rules:
   - SSH (22) - Your IP
   - HTTP (80) - Anywhere
   - HTTPS (443) - Anywhere
7. **Storage:** 20GB gp3
8. Click "Launch Instance"

#### Step 3: Allocate Elastic IP (Static IP)

1. Go to EC2 → Elastic IPs
2. Click "Allocate Elastic IP address"
3. Click "Allocate"
4. Select the IP → Actions → "Associate Elastic IP address"
5. Select your instance
6. Click "Associate"

#### Step 4: Connect to Instance

```bash
# Make key file secure
chmod 400 your-key.pem

# Connect via SSH
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
```

#### Step 5: Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version
npm --version

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Git
sudo apt install -y git
```

#### Step 6: Clone and Setup Application

```bash
# Navigate to home
cd /home/ubuntu

# Clone repository
git clone https://github.com/YOUR_USERNAME/gryd.git

# Navigate to backend
cd gryd/backend/api-gateway

# Install dependencies
npm install

# Create environment file
nano .env
# Paste your environment variables from Section 4.1
```

#### Step 7: Start Application with PM2

```bash
# Start application
pm2 start src/index.js --name gryd-api

# Save configuration
pm2 save

# Setup startup script
pm2 startup
# Run the command it outputs with sudo

# Verify
pm2 status
```

#### Step 8: Configure Nginx

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/gryd
```

Paste configuration:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable configuration:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/gryd /etc/nginx/sites-enabled/

# Remove default
sudo rm /etc/nginx/sites-enabled/default

# Test and restart
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

#### Step 9: Add SSL Certificate

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Test renewal
sudo certbot renew --dry-run
```

**Your backend is now live at:** `https://your-domain.com`

---

### Frontend Deployment (Vercel)

**Same for both DigitalOcean and AWS backend**

#### Step 1: Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub

#### Step 2: Import Project

1. Click "Add New" → "Project"
2. Import your GitHub repository
3. Configure:
   - **Root Directory:** `frontend/ios-app-new`
   - **Framework Preset:** Other
   - **Build Command:** `npx expo export --platform web`
   - **Output Directory:** `dist`

#### Step 3: Add Environment Variable

1. Go to Settings → Environment Variables
2. Add:
   - **Name:** `EXPO_PUBLIC_API_BASE_URL`
   - **Value:** `https://your-backend-domain.com` (your DigitalOcean/AWS URL)

#### Step 4: Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Your frontend is live!

**Your frontend URL:** `https://your-project.vercel.app`

---

## 6. Post-Deployment Setup

### 6.1 Update Backend PUBLIC_APP_URL

After deploying frontend, update your backend `.env`:

```bash
# SSH to your server
ssh root@YOUR_SERVER_IP  # DigitalOcean
# or
ssh -i key.pem ubuntu@YOUR_SERVER_IP  # AWS

# Edit .env
nano /root/gryd/backend/api-gateway/.env  # DigitalOcean
# or
nano /home/ubuntu/gryd/backend/api-gateway/.env  # AWS

# Update this line:
PUBLIC_APP_URL=https://your-project.vercel.app

# Save and restart
pm2 restart gryd-api
```

### 6.2 Create Super Admin Account

1. Open your frontend URL: `https://your-project.vercel.app`
2. Navigate to `/super-admin-signup`
3. Create your Super Admin account
4. Login and start managing your platform

### 6.3 Verify Everything Works

| Test | How | Expected Result |
|------|-----|-----------------|
| Frontend loads | Visit your Vercel URL | App loads without errors |
| Backend responds | Visit `https://backend-url/api/health` | Returns OK or JSON |
| Login works | Try logging in | Successfully authenticates |
| Email works | Send a test invite | Email received |
| Calls work | Start a test call | Audio/video connects |
| Uploads work | Upload a profile picture | Image saves and displays |

---

## 7. Quick Reference

### Essential Commands

```bash
# ===== PM2 (Application) =====
pm2 status                    # Check if app is running
pm2 logs gryd-api             # View logs
pm2 logs gryd-api --lines 100 # Last 100 lines
pm2 restart gryd-api          # Restart app
pm2 stop gryd-api             # Stop app
pm2 monit                     # Monitor resources

# ===== Nginx (Web Server) =====
sudo systemctl status nginx   # Check status
sudo systemctl restart nginx  # Restart
sudo nginx -t                 # Test configuration

# ===== Updates =====
cd /path/to/gryd
git pull origin main          # Get latest code
cd backend/api-gateway
npm install                   # Install new dependencies
pm2 restart gryd-api          # Apply updates

# ===== Server Info =====
df -h                         # Disk space
free -m                       # Memory usage
htop                          # Process monitor (install: apt install htop)
```

### Environment Variables Checklist

```
✅ MONGO_URI            - MongoDB connection string
✅ JWT_SECRET           - 64+ character secret
✅ BREVO_API_KEY        - Brevo email API key
✅ EMAIL_FROM_ADDRESS   - Verified sender email
✅ EMAIL_FROM_NAME      - Display name for emails
✅ CLOUDINARY_CLOUD_NAME
✅ CLOUDINARY_API_KEY
✅ CLOUDINARY_API_SECRET
✅ AGORA_APP_ID
✅ AGORA_APP_CERTIFICATE
✅ PUBLIC_APP_URL       - Your Vercel frontend URL
✅ PORT                 - Usually 3000
```

### Useful URLs

| Service | Dashboard URL |
|---------|---------------|
| MongoDB Atlas | [cloud.mongodb.com](https://cloud.mongodb.com) |
| Cloudinary | [cloudinary.com/console](https://cloudinary.com/console) |
| Agora | [console.agora.io](https://console.agora.io) |
| Brevo | [app.brevo.com](https://app.brevo.com) |
| Vercel | [vercel.com/dashboard](https://vercel.com/dashboard) |
| DigitalOcean | [cloud.digitalocean.com](https://cloud.digitalocean.com) |
| AWS | [console.aws.amazon.com](https://console.aws.amazon.com) |

### Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| App not starting | Check `pm2 logs gryd-api` for errors |
| Database connection failed | Verify MONGO_URI and IP whitelist |
| Emails not sending | Check BREVO_API_KEY and sender verification |
| Calls not working | Verify AGORA credentials and certificate enabled |
| 502 Bad Gateway | App crashed - run `pm2 restart gryd-api` |
| SSL certificate expired | Run `sudo certbot renew` |

---

## Summary: Which Option to Choose?

| If You... | Choose |
|-----------|--------|
| Want simplest setup | **DigitalOcean** |
| Are new to servers | **DigitalOcean** |
| Want predictable pricing | **DigitalOcean** |
| Already use AWS | **AWS** |
| Need auto-scaling | **AWS** |
| Have DevOps team | **AWS** |
| Need compliance (HIPAA, etc.) | **AWS** |

---

**Congratulations!** You now have a complete guide to deploy your GRYD platform on either DigitalOcean or AWS.

For questions or support, contact: [Your Contact Information]

---

*Document Version 1.0 | January 2026*
