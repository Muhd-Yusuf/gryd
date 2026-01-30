# GRYD Platform
## Client Handover Document

---

![GRYD Platform](https://via.placeholder.com/800x200/1a1a2e/ffffff?text=GRYD+Platform)

**Document Version:** 1.0
**Handover Date:** January 2026
**Prepared By:** [Your Company Name]
**Prepared For:** [Client Name]

---

## Table of Contents

1. [Welcome & Congratulations](#1-welcome--congratulations)
2. [What You're Receiving](#2-what-youre-receiving)
3. [Platform Overview](#3-platform-overview)
4. [Account Setup Guide](#4-account-setup-guide)
5. [Environment Configuration](#5-environment-configuration)
6. [Deployment Guide](#6-deployment-guide)
7. [Admin Access & First Steps](#7-admin-access--first-steps)
8. [Ongoing Costs](#8-ongoing-costs)
9. [Maintenance & Updates](#9-maintenance--updates)
10. [Troubleshooting](#10-troubleshooting)
11. [Support & Contact](#11-support--contact)

---

## 1. Welcome & Congratulations

Congratulations on the successful completion of your **GRYD Community Platform**!

You now own a powerful, scalable communication platform designed specifically for credit unions and member-based organizations. This document will guide you through everything you need to take full ownership and control of your platform.

### What Makes GRYD Special

- **Multi-tenant Architecture** - Support unlimited credit unions/communities
- **Real-time Communication** - Instant messaging that rivals Discord and Slack
- **Voice & Video Calls** - HD quality calls powered by enterprise-grade Agora
- **Passwordless Authentication** - Modern, secure OTP-based login
- **Scalable Infrastructure** - Grows with your organization from 100 to 100,000+ members

---

## 2. What You're Receiving

### 2.1 Complete Source Code

| Component | Technology | Location |
|-----------|------------|----------|
| Backend API | Node.js + Express | `/backend/api-gateway/` |
| Frontend Web App | React Native + Expo | `/frontend/ios-app-new/` |
| Documentation | Markdown | Root directory |

### 2.2 Documentation Package

| Document | Purpose |
|----------|---------|
| `GRYD_Client_Handover_Document.md` | This document - complete setup guide |
| `GRYD_Infrastructure_Proposal.md` | Detailed cost analysis & scaling options |
| `GRYD_Cost_Summary.md` | Quick reference pricing |
| `GRYD_Milestone_Report.md` | Project completion summary |
| `README.md` | Technical overview |

### 2.3 Included Features

#### User Management
- [x] Super Admin dashboard
- [x] Credit Union Admin (CU Admin) management
- [x] Stakeholder accounts (vendors, partners, sponsors, investors)
- [x] Member accounts with invite codes
- [x] Role-based access control

#### Communication
- [x] Real-time text messaging
- [x] Direct messages (1-on-1)
- [x] Group channels
- [x] Voice calls (HD audio)
- [x] Video calls (HD video)
- [x] Voice messages

#### Content & Media
- [x] Image uploads
- [x] File sharing
- [x] Profile pictures
- [x] Community logos & branding

#### Notifications
- [x] Email invitations
- [x] OTP verification
- [x] Activity notifications

---

## 3. Platform Overview

### 3.1 User Roles & Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                      SUPER ADMIN                             │
│              (Platform Owner - Full Access)                  │
│                                                              │
│   • Manage all credit unions/communities                     │
│   • View platform-wide analytics                             │
│   • Invite CU Admins                                         │
│   • System configuration                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│      CU ADMIN       │       │      CU ADMIN       │
│  (Credit Union 1)   │       │  (Credit Union 2)   │
│                     │       │                     │
│ • Manage community  │       │ • Manage community  │
│ • Invite members    │       │ • Invite members    │
│ • Invite stakeholders       │ • Invite stakeholders
│ • Create channels   │       │ • Create channels   │
└──────────┬──────────┘       └──────────┬──────────┘
           │                             │
     ┌─────┴─────┐                 ┌─────┴─────┐
     ▼           ▼                 ▼           ▼
┌─────────┐ ┌─────────┐       ┌─────────┐ ┌─────────┐
│STAKEHOLDER│MEMBERS │       │STAKEHOLDER│MEMBERS │
│(VIP badge)│         │       │(VIP badge)│         │
└─────────┘ └─────────┘       └─────────┘ └─────────┘
```

### 3.2 User Flows

| User Type | How They Join |
|-----------|---------------|
| **Super Admin** | Direct signup with secret key |
| **CU Admin** | Email invite from Super Admin → Setup wizard |
| **Stakeholder** | Email invite from CU Admin → OTP verification → Profile setup |
| **Member** | Invite code from CU Admin → OTP verification → Profile setup |

### 3.3 System Architecture

```
                    ┌─────────────────┐
                    │     USERS       │
                    │ (Web & Mobile)  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    FRONTEND     │
                    │    (Vercel)     │
                    │                 │
                    │ React Native +  │
                    │     Expo        │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    BACKEND      │
                    │ (DigitalOcean/  │
                    │  AWS/Render)    │
                    │                 │
                    │ Node.js +       │
                    │ Express         │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   MongoDB     │   │  Cloudinary   │   │    Agora      │
│   Atlas       │   │               │   │               │
│  (Database)   │   │ (File Storage)│   │(Voice/Video)  │
└───────────────┘   └───────────────┘   └───────────────┘
                             │
                             ▼
                    ┌───────────────┐
                    │    Brevo      │
                    │   (Email)     │
                    └───────────────┘
```

---

## 4. Account Setup Guide

You need to create accounts with the following services. **All have free tiers to start.**

### 4.1 MongoDB Atlas (Database)

**What it does:** Stores all your data (users, messages, communities)

**Setup Steps:**
1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. Click "Try Free" and create account
3. Create a new project (name it "GRYD")
4. Build a Database:
   - Choose **M0 (Free)** for testing or **M10 ($57/mo)** for production
   - Select region closest to your users
   - Click "Create"
5. Create Database User:
   - Go to "Database Access" → "Add New Database User"
   - Choose username and strong password
   - Role: "Read and Write to any database"
   - **Save these credentials!**
6. Network Access:
   - Go to "Network Access" → "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Or add specific server IPs for better security
7. Get Connection String:
   - Go to "Database" → "Connect" → "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Add database name: `.../gryd?retryWrites=true`

**Your connection string will look like:**
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/gryd?retryWrites=true&w=majority
```

---

### 4.2 Cloudinary (Media Storage)

**What it does:** Stores images, profile pictures, and uploaded files

**Setup Steps:**
1. Go to [cloudinary.com](https://cloudinary.com)
2. Click "Sign Up For Free"
3. Complete registration
4. Go to Dashboard
5. Copy these values:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

**Free tier includes:** 25GB storage, 25GB bandwidth/month

---

### 4.3 Agora (Voice & Video Calls)

**What it does:** Powers all voice and video calling features

**Setup Steps:**
1. Go to [agora.io](https://agora.io)
2. Click "Sign Up" and create account
3. Go to Console → Project Management
4. Click "Create New Project"
   - Project name: "GRYD"
   - Authentication: Select "Secured mode: APP ID + Token"
5. Click into your project
6. Copy these values:
   - **App ID**
   - **App Certificate** (click to enable if not visible)

**Free tier includes:** 10,000 minutes/month (audio & video)

---

### 4.4 Brevo (Email Service)

**What it does:** Sends invitation emails, OTP codes, and notifications

**Setup Steps:**
1. Go to [brevo.com](https://brevo.com)
2. Click "Sign Up Free"
3. Complete registration and verify your email
4. Go to SMTP & API → API Keys
5. Click "Generate a new API key"
6. Name it "GRYD Production"
7. Copy the **API Key**

**Important:** Set up a sender email:
1. Go to Senders & IP → Senders
2. Add and verify your sending email address
3. Use a professional email (e.g., noreply@yourcompany.com)

**Free tier includes:** 300 emails/day

---

### 4.5 Generate JWT Secret

**What it does:** Secures user authentication tokens

**How to generate:**

Option 1 - Using Terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Option 2 - Online Generator:
- Go to [randomkeygen.com](https://randomkeygen.com)
- Use a "CodeIgniter Encryption Key" or similar (64+ characters)

**Example output:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0
```

**⚠️ IMPORTANT:**
- Keep this secret SAFE
- Never share it publicly
- Use a DIFFERENT secret for production than testing

---

## 5. Environment Configuration

### 5.1 Complete Environment Variables

Create a `.env` file with these values:

```env
# ===========================================
# GRYD PLATFORM - PRODUCTION CONFIGURATION
# ===========================================

# Server
PORT=3000

# -----------------
# DATABASE
# -----------------
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/gryd?retryWrites=true&w=majority

# -----------------
# AUTHENTICATION
# -----------------
JWT_SECRET=YOUR_64_CHARACTER_SECRET_HERE

# -----------------
# EMAIL SERVICE (Brevo)
# -----------------
BREVO_API_KEY=xkeysib-your-api-key-here
EMAIL_FROM_ADDRESS=noreply@yourcompany.com
EMAIL_FROM_NAME=GRYD Platform
SKIP_BREVO_IP_CHECK=false

# -----------------
# FILE STORAGE (Cloudinary)
# -----------------
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# -----------------
# VOICE/VIDEO CALLS (Agora)
# -----------------
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-certificate

# -----------------
# APPLICATION
# -----------------
PUBLIC_APP_URL=https://your-frontend-domain.com
```

### 5.2 Frontend Environment Variable

For the frontend, you only need one variable:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-backend-domain.com
```

---

## 6. Deployment Guide

### 6.1 Option A: Simple Deployment (Recommended to Start)

| Component | Platform | Cost |
|-----------|----------|------|
| Frontend | Vercel | Free - $20/mo |
| Backend | Render | Free - $25/mo |
| Database | MongoDB Atlas | Free - $57/mo |

#### Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - **Root Directory:** `frontend/ios-app-new`
   - **Build Command:** `npx expo export --platform web`
   - **Output Directory:** `dist`
5. Add Environment Variable:
   - `EXPO_PUBLIC_API_BASE_URL` = `https://your-backend-url.com`
6. Click "Deploy"

#### Deploy Backend to Render

1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Root Directory:** `backend/api-gateway`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add all environment variables from Section 5.1
6. Click "Create Web Service"

---

### 6.2 Option B: Production Deployment (DigitalOcean)

For better reliability with many members:

| Component | Platform | Cost |
|-----------|----------|------|
| Frontend | Vercel | $20/mo |
| Backend | DigitalOcean Droplet | $24/mo |
| Database | MongoDB Atlas M10 | $57/mo |

#### DigitalOcean Setup

1. Create account at [digitalocean.com](https://digitalocean.com)
2. Create Droplet:
   - Image: Ubuntu 22.04
   - Plan: Basic $24/mo (4GB RAM)
   - Region: Closest to your users
3. SSH into your server:
   ```bash
   ssh root@your-server-ip
   ```
4. Run setup commands:
   ```bash
   # Update system
   apt update && apt upgrade -y

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt install -y nodejs

   # Install PM2 & Nginx
   npm install -g pm2
   apt install -y nginx

   # Clone your code
   git clone https://github.com/your-repo/gryd.git
   cd gryd/backend/api-gateway

   # Install dependencies
   npm install

   # Create .env file
   nano .env
   # (paste your environment variables)

   # Start with PM2
   pm2 start src/index.js --name gryd-api
   pm2 save
   pm2 startup
   ```

5. Configure Nginx (create `/etc/nginx/sites-available/gryd`):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. Enable and restart:
   ```bash
   ln -s /etc/nginx/sites-available/gryd /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   ```

7. Add SSL (free):
   ```bash
   apt install certbot python3-certbot-nginx
   certbot --nginx -d your-domain.com
   ```

---

## 7. Admin Access & First Steps

### 7.1 Create Super Admin Account

1. Open your deployed frontend URL
2. Navigate to `/super-admin-signup`
3. Fill in:
   - First Name
   - Last Name
   - Email
   - Secret Key (set in backend or use default)
4. Complete signup

### 7.2 First Steps as Super Admin

1. **Login** at `/admin-login` or main login page
2. **Access Dashboard** - View platform overview
3. **Create First Customer (Credit Union)**:
   - Go to Customers → Add Customer
   - Enter credit union name and admin email
   - System sends setup invitation to CU Admin
4. **Monitor** signups and activity

### 7.3 CU Admin First Steps

1. **Check Email** for setup invitation
2. **Click Setup Link** → Complete profile
3. **Customize Server**:
   - Upload logo
   - Set server name
   - Add description
4. **Invite Members**:
   - Go to Settings → Invite Members
   - Copy invite code
   - Share with members
5. **Invite Stakeholders**:
   - Enter stakeholder email
   - Select badge type (vendor, partner, sponsor, investor)
   - Send invitation

---

## 8. Ongoing Costs

### 8.1 Monthly Cost Summary

| Members | Recommended Tier | Monthly Cost | Annual Cost |
|---------|------------------|--------------|-------------|
| < 500 | Starter (Free tiers) | $0-20 | $0-240 |
| 500-2,500 | Growth | $113 | $1,356 |
| 2,500-10,000 | Professional | $280-370 | $3,360-4,440 |
| 10,000+ | Enterprise | $958+ | $11,496+ |

### 8.2 Cost Breakdown by Service

| Service | Free Tier | Production |
|---------|-----------|------------|
| MongoDB Atlas | 512MB (M0) | $57/mo (M10) |
| Cloudinary | 25GB storage | $99/mo (Plus) |
| Agora | 10,000 mins/mo | ~$0.99-3.99/1000 mins |
| Brevo | 300 emails/day | $25/mo (20K emails) |
| Vercel | 100GB bandwidth | $20/mo (Pro) |
| DigitalOcean | - | $24/mo (4GB Droplet) |

### 8.3 Variable Costs

| Service | What Increases Cost |
|---------|---------------------|
| Agora | More voice/video call minutes |
| Cloudinary | More file uploads and storage |
| Brevo | More emails sent |
| MongoDB | More data stored |

---

## 9. Maintenance & Updates

### 9.1 Regular Maintenance Tasks

| Task | Frequency | How |
|------|-----------|-----|
| Check server status | Daily | PM2 status, check logs |
| Database backups | Automatic (Atlas) | Verify in MongoDB dashboard |
| SSL renewal | Automatic (Certbot) | Verify certificate valid |
| Dependency updates | Monthly | `npm audit`, `npm update` |
| Log review | Weekly | Check for errors |

### 9.2 Updating the Application

```bash
# SSH into server
ssh root@your-server-ip

# Navigate to project
cd /path/to/gryd

# Pull latest code
git pull origin main

# Install any new dependencies
cd backend/api-gateway
npm install

# Restart application
pm2 restart gryd-api

# Check status
pm2 status
pm2 logs gryd-api
```

### 9.3 Monitoring Commands

```bash
# Check if app is running
pm2 status

# View logs
pm2 logs gryd-api

# View last 100 log lines
pm2 logs gryd-api --lines 100

# Monitor resources
pm2 monit

# Check Nginx status
systemctl status nginx

# Check disk space
df -h

# Check memory
free -m
```

---

## 10. Troubleshooting

### 10.1 Common Issues & Solutions

#### App Not Starting
```bash
# Check logs
pm2 logs gryd-api --lines 50

# Common fixes:
# 1. Check .env file exists and has correct values
# 2. Verify MongoDB connection string
# 3. Check if port 3000 is available
```

#### Database Connection Failed
```
Error: MongoNetworkError
```
**Solution:**
1. Check MongoDB Atlas Network Access (whitelist IP)
2. Verify connection string is correct
3. Check username/password in connection string

#### Emails Not Sending
```
Error: Brevo API error
```
**Solution:**
1. Verify BREVO_API_KEY is correct
2. Check sender email is verified in Brevo
3. Check Brevo dashboard for error logs

#### Calls Not Working
```
Error: Agora initialization failed
```
**Solution:**
1. Verify AGORA_APP_ID and AGORA_APP_CERTIFICATE
2. Check Agora console for project status
3. Ensure App Certificate is enabled

#### 404 Errors on Direct URLs
**Solution:**
- Ensure `vercel.json` has rewrites configured
- For Nginx, add try_files directive

### 10.2 Getting Help

| Issue Type | Where to Look |
|------------|---------------|
| MongoDB issues | [MongoDB Docs](https://docs.mongodb.com) |
| Agora issues | [Agora Docs](https://docs.agora.io) |
| Cloudinary issues | [Cloudinary Docs](https://cloudinary.com/documentation) |
| Brevo issues | [Brevo Help](https://help.brevo.com) |
| Node.js issues | [Node.js Docs](https://nodejs.org/docs) |

---

## 11. Support & Contact

### 11.1 Post-Handover Support

| Support Level | Included | Duration |
|---------------|----------|----------|
| Bug Fixes | Critical bugs only | 30 days |
| Email Support | Questions about setup | 14 days |
| Documentation | This handover package | Permanent |

### 11.2 Extended Support Options

| Package | What's Included | Monthly Cost |
|---------|-----------------|--------------|
| Basic | Email support, 48hr response | $200/mo |
| Standard | Email + chat, 24hr response, monthly maintenance | $500/mo |
| Premium | Priority support, 4hr response, weekly maintenance | $1,000/mo |

### 11.3 Contact Information

**Developer:** [Your Name]
**Email:** [your-email@domain.com]
**Phone:** [Your Phone Number]
**Business Hours:** [Your Hours]

---

## Quick Reference Card

### Essential URLs (Update with your domains)

| Service | URL |
|---------|-----|
| Frontend | https://your-app.vercel.app |
| Backend API | https://your-api.onrender.com |
| MongoDB Atlas | https://cloud.mongodb.com |
| Cloudinary | https://cloudinary.com/console |
| Agora Console | https://console.agora.io |
| Brevo Dashboard | https://app.brevo.com |

### Essential Commands

```bash
# Server
pm2 status                    # Check app status
pm2 restart gryd-api          # Restart app
pm2 logs gryd-api             # View logs

# Updates
git pull origin main          # Get latest code
npm install                   # Install dependencies
pm2 restart gryd-api          # Apply updates

# Nginx
systemctl status nginx        # Check web server
systemctl restart nginx       # Restart web server
```

### Environment Variables Checklist

```
□ MONGO_URI           - MongoDB connection string
□ JWT_SECRET          - Authentication secret (64+ chars)
□ BREVO_API_KEY       - Email service API key
□ EMAIL_FROM_ADDRESS  - Verified sender email
□ EMAIL_FROM_NAME     - Sender display name
□ CLOUDINARY_CLOUD_NAME
□ CLOUDINARY_API_KEY
□ CLOUDINARY_API_SECRET
□ AGORA_APP_ID
□ AGORA_APP_CERTIFICATE
□ PUBLIC_APP_URL      - Your frontend URL
□ PORT                - Usually 3000
```

---

## Congratulations!

You now have everything you need to run and maintain your GRYD platform. This platform is built to scale with your organization and serve your members for years to come.

**Thank you for choosing us for your project!**

---

*Document Version 1.0 | January 2026*
*© 2026 [Your Company Name]. All rights reserved.*
