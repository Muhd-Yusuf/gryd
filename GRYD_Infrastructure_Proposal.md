# GRYD Platform - Infrastructure & Cost Proposal

**Prepared for:** [Client Name]
**Prepared by:** [Your Company Name]
**Date:** January 22, 2026
**Version:** 1.0

---

## Executive Summary

This proposal outlines the infrastructure requirements, service costs, and scaling options for deploying the GRYD community platform in a production environment. GRYD is a comprehensive communication platform featuring real-time messaging, voice/video calls, file sharing, and community management capabilities.

The platform is designed to scale from hundreds to tens of thousands of members while maintaining performance, reliability, and security.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Infrastructure Architecture](#2-infrastructure-architecture)
3. [Service Providers & Costs](#3-service-providers--costs)
4. [Pricing Tiers](#4-pricing-tiers)
5. [Detailed Cost Breakdown](#5-detailed-cost-breakdown)
6. [Scaling Roadmap](#6-scaling-roadmap)
7. [Security & Compliance](#7-security--compliance)
8. [Support & Maintenance](#8-support--maintenance)
9. [Recommendations](#9-recommendations)
10. [Terms & Conditions](#10-terms--conditions)

---

## 1. Platform Overview

### 1.1 Core Features

| Feature | Description |
|---------|-------------|
| **Community Management** | Create and manage multiple communities (subgrids) with custom branding |
| **Real-time Messaging** | Text channels, direct messages, and group chats with instant delivery |
| **Voice & Video Calls** | HD audio/video calls for 1-on-1 and group conversations |
| **File Sharing** | Image, document, and voice note uploads with cloud storage |
| **User Roles** | Multi-tier access: Super Admin, CU Admin, Stakeholders, Members |
| **Email Notifications** | Automated invitations, OTP verification, and activity alerts |
| **Mobile & Web Support** | Cross-platform access via web browsers and mobile apps |

### 1.2 User Types

| Role | Description |
|------|-------------|
| **Super Admin** | Platform owner with full system access |
| **CU Admin (Credit Union Admin)** | Community administrators who manage their organization |
| **Stakeholder** | VIP users (vendors, partners, sponsors, investors) with special badges |
| **Member** | Regular community members |

---

## 2. Infrastructure Architecture

### 2.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USERS                                      │
│                    (Web & Mobile Apps)                               │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Vercel)                               │
│                   React Native Web / Expo                            │
│                 CDN + Auto-scaling + SSL                             │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   BACKEND API (DigitalOcean)                         │
│                      Node.js + Express                               │
│                    PM2 + Nginx + SSL                                 │
└───────┬─────────────────────┼─────────────────────┬─────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌───────────────────┐
│   MongoDB     │   │    Cloudinary   │   │      Agora        │
│   Atlas       │   │   (Media CDN)   │   │  (Voice/Video)    │
│  (Database)   │   │                 │   │                   │
└───────────────┘   └─────────────────┘   └───────────────────┘
        │
        ▼
┌───────────────┐
│    Brevo      │
│   (Email)     │
└───────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React Native + Expo | Cross-platform web & mobile app |
| Backend | Node.js + Express.js | REST API server |
| Database | MongoDB Atlas | Data storage (users, messages, communities) |
| Real-time | Socket.io | Live messaging and notifications |
| Voice/Video | Agora SDK | HD audio/video calling |
| File Storage | Cloudinary | Image, video, and file hosting |
| Email | Brevo (Sendinblue) | Transactional emails |
| Frontend Hosting | Vercel | CDN, auto-scaling, SSL |
| Backend Hosting | DigitalOcean | Virtual private server |

---

## 3. Service Providers & Costs

### 3.1 Vercel (Frontend Hosting)

**Purpose:** Hosts the web application with global CDN distribution.

| Plan | Bandwidth | Builds | Price | Best For |
|------|-----------|--------|-------|----------|
| Hobby (Free) | 100GB/mo | 6000 mins/mo | $0/mo | Development & Testing |
| Pro | 1TB/mo | Unlimited | $20/mo | Production |
| Enterprise | Unlimited | Unlimited | Custom | Large scale |

**Included Features:**
- Automatic HTTPS/SSL
- Global CDN (Edge Network)
- Automatic deployments from Git
- Preview deployments for testing
- Analytics and monitoring

---

### 3.2 DigitalOcean (Backend Hosting)

**Purpose:** Hosts the Node.js API server.

| Plan | vCPU | RAM | Storage | Transfer | Price |
|------|------|-----|---------|----------|-------|
| Basic | 1 | 1GB | 25GB SSD | 1TB | $6/mo |
| Basic | 1 | 2GB | 50GB SSD | 2TB | $12/mo |
| Basic | 2 | 2GB | 60GB SSD | 3TB | $18/mo |
| General Purpose | 2 | 4GB | 80GB SSD | 4TB | $24/mo |
| General Purpose | 4 | 8GB | 160GB SSD | 5TB | $48/mo |
| General Purpose | 8 | 16GB | 320GB SSD | 6TB | $96/mo |

**Additional Services:**
| Service | Price |
|---------|-------|
| Load Balancer | $12/mo |
| Managed Database | $15-60/mo |
| Spaces (Object Storage) | $5/mo + usage |
| Backups | 20% of droplet cost |

---

### 3.3 MongoDB Atlas (Database)

**Purpose:** Stores all application data (users, messages, communities, etc.)

| Cluster Tier | Storage | RAM | Price | Recommended Users |
|--------------|---------|-----|-------|-------------------|
| M0 (Free) | 512MB | Shared | $0/mo | < 100 (Dev only) |
| M2 | 2GB | Shared | $9/mo | < 1,000 |
| M5 | 5GB | Shared | $25/mo | < 2,500 |
| M10 | 10GB | 2GB | $57/mo | < 10,000 |
| M20 | 20GB | 4GB | $140/mo | < 25,000 |
| M30 | 40GB | 8GB | $280/mo | < 50,000 |
| M40 | 80GB | 16GB | $560/mo | 50,000+ |

**Included Features:**
- Automatic backups
- Point-in-time recovery
- Encryption at rest
- Network isolation
- Performance monitoring

---

### 3.4 Agora (Voice & Video Calls)

**Purpose:** Powers real-time voice and video communication.

| Service | Free Tier | Price After Free Tier |
|---------|-----------|----------------------|
| Audio Calls | 10,000 mins/mo | $0.99 per 1,000 mins |
| HD Video (720p) | 10,000 mins/mo | $3.99 per 1,000 mins |
| Full HD Video (1080p) | 10,000 mins/mo | $8.99 per 1,000 mins |

**Cost Estimation by Usage:**

| Members | Est. Audio Mins/mo | Est. Video Mins/mo | Est. Cost/mo |
|---------|-------------------|-------------------|--------------|
| 500 | 5,000 | 2,000 | $0 (free tier) |
| 2,000 | 20,000 | 8,000 | ~$42 |
| 5,000 | 50,000 | 20,000 | ~$120 |
| 10,000 | 100,000 | 40,000 | ~$250 |

---

### 3.5 Cloudinary (Media Storage & CDN)

**Purpose:** Stores and delivers images, videos, and files.

| Plan | Storage | Bandwidth | Transformations | Price |
|------|---------|-----------|-----------------|-------|
| Free | 25GB | 25GB/mo | 25,000/mo | $0/mo |
| Plus | 225GB | 225GB/mo | 225,000/mo | $99/mo |
| Advanced | 900GB | 900GB/mo | 900,000/mo | $249/mo |
| Enterprise | Custom | Custom | Custom | Custom |

**Included Features:**
- Automatic image optimization
- Responsive image delivery
- Video transcoding
- Global CDN delivery
- AI-powered tagging

---

### 3.6 Brevo (Email Service)

**Purpose:** Sends transactional emails (invitations, OTP, notifications).

| Plan | Emails/Month | Price |
|------|--------------|-------|
| Free | 300/day (~9,000/mo) | $0/mo |
| Starter | 20,000 | $25/mo |
| Business | 50,000 | $65/mo |
| Enterprise | 100,000+ | Custom |

**Email Types Sent:**
- Member invitation emails
- Stakeholder invitation emails
- CU Admin setup emails
- OTP verification codes
- Password reset emails
- Activity notifications

---

### 3.7 Domain & SSL

| Item | Provider Options | Price |
|------|------------------|-------|
| Domain (.com) | Namecheap, GoDaddy, Google Domains | $10-15/year |
| Domain (.io) | Namecheap, GoDaddy | $35-50/year |
| SSL Certificate | Included with Vercel & Let's Encrypt | $0 (Free) |

---

## 4. Pricing Tiers

### Tier 1: Starter (Testing & Small Groups)

**Best for:** Development, testing, pilot programs
**Capacity:** Up to 500 members

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Frontend Hosting | Vercel Free | $0 |
| Backend Hosting | Render Free | $0 |
| Database | MongoDB M0 | $0 |
| Voice/Video | Agora Free | $0 |
| Media Storage | Cloudinary Free | $0 |
| Email | Brevo Free | $0 |
| Domain | .com | ~$1 |
| **TOTAL** | | **$1/mo** |

**Annual Cost:** ~$12/year

⚠️ **Limitations:**
- Backend may sleep after 15 mins of inactivity (slow first request)
- Limited storage (512MB database, 25GB media)
- No guaranteed uptime SLA

---

### Tier 2: Growth (Small to Medium Organizations)

**Best for:** Active communities, credit unions with regular usage
**Capacity:** 500 - 2,500 members

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Frontend Hosting | Vercel Pro | $20 |
| Backend Hosting | DigitalOcean 2GB | $12 |
| Database | MongoDB M5 | $25 |
| Voice/Video | Agora (estimated) | $30 |
| Media Storage | Cloudinary Free | $0 |
| Email | Brevo Starter | $25 |
| Domain | .com | ~$1 |
| **TOTAL** | | **$113/mo** |

**Annual Cost:** ~$1,356/year

✅ **Benefits:**
- Always-on backend (no sleep)
- 5GB database storage
- Professional email delivery
- Reliable for daily active use

---

### Tier 3: Professional (Medium Organizations)

**Best for:** Growing organizations with active voice/video usage
**Capacity:** 2,500 - 10,000 members

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Frontend Hosting | Vercel Pro | $20 |
| Backend Hosting | DigitalOcean 4GB | $24 |
| Database | MongoDB M10 | $57 |
| Voice/Video | Agora (estimated) | $100 |
| Media Storage | Cloudinary Plus | $99 |
| Email | Brevo Business | $65 |
| Domain | .com | ~$1 |
| Backups | DigitalOcean | $5 |
| **TOTAL** | | **$371/mo** |

**Annual Cost:** ~$4,452/year

✅ **Benefits:**
- Dedicated database resources
- High-capacity media storage
- Full email automation capabilities
- Daily automated backups

---

### Tier 4: Enterprise (Large Organizations)

**Best for:** Large credit unions, multi-branch organizations
**Capacity:** 10,000 - 50,000+ members

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Frontend Hosting | Vercel Pro | $20 |
| Backend Hosting | DigitalOcean 8GB + Load Balancer | $108 |
| Database | MongoDB M20 | $140 |
| Voice/Video | Agora (estimated) | $300 |
| Media Storage | Cloudinary Advanced | $249 |
| Email | Brevo Enterprise | $100 |
| Domain | .com | ~$1 |
| Backups | DigitalOcean | $20 |
| Monitoring | Additional | $20 |
| **TOTAL** | | **$958/mo** |

**Annual Cost:** ~$11,496/year

✅ **Benefits:**
- Load-balanced infrastructure
- High-availability setup
- Enterprise-grade database
- Priority support options
- Advanced monitoring & alerts

---

## 5. Detailed Cost Breakdown

### 5.1 One-Time Setup Costs

| Item | Description | Cost |
|------|-------------|------|
| Domain Registration | 1-year registration | $10-15 |
| Initial Server Setup | DigitalOcean configuration | Included |
| SSL Configuration | Let's Encrypt setup | $0 |
| DNS Configuration | Domain pointing | $0 |
| **Total One-Time** | | **$10-15** |

### 5.2 Monthly Recurring Costs by Tier

| Tier | Monthly | Quarterly | Annual |
|------|---------|-----------|--------|
| Starter | $1 | $3 | $12 |
| Growth | $113 | $339 | $1,356 |
| Professional | $371 | $1,113 | $4,452 |
| Enterprise | $958 | $2,874 | $11,496 |

### 5.3 Variable Costs (Usage-Based)

These costs scale with actual usage:

| Service | Cost Driver | Approximate Rate |
|---------|-------------|------------------|
| Agora | Call minutes used | $0.99-8.99/1000 mins |
| Cloudinary | Storage + bandwidth | Based on plan limits |
| Brevo | Emails sent | Based on plan limits |
| DigitalOcean | Bandwidth overage | $0.01/GB over limit |

---

## 6. Scaling Roadmap

### Phase 1: Launch (Months 1-3)
- **Tier:** Growth ($113/mo)
- **Target:** 500-1,000 members
- **Focus:** Platform stability, user onboarding

### Phase 2: Growth (Months 4-6)
- **Tier:** Growth → Professional
- **Target:** 1,000-3,000 members
- **Upgrades:** Database to M10, add Cloudinary Plus

### Phase 3: Scale (Months 7-12)
- **Tier:** Professional ($371/mo)
- **Target:** 3,000-7,000 members
- **Upgrades:** Larger droplet, increased Agora usage

### Phase 4: Enterprise (Year 2+)
- **Tier:** Enterprise ($958/mo)
- **Target:** 10,000+ members
- **Upgrades:** Load balancing, multi-region deployment

---

## 7. Security & Compliance

### 7.1 Security Features Included

| Feature | Implementation |
|---------|----------------|
| **Data Encryption** | TLS 1.3 for data in transit, AES-256 for data at rest |
| **Authentication** | JWT tokens with secure session management |
| **Password Security** | Bcrypt hashing with salt |
| **OTP Verification** | Email-based one-time passwords |
| **API Security** | Rate limiting, input validation, CORS protection |
| **Database Security** | Network isolation, IP whitelisting |

### 7.2 Compliance Considerations

| Standard | Status |
|----------|--------|
| HTTPS/SSL | ✅ Included (all tiers) |
| Data Encryption | ✅ Included (all tiers) |
| GDPR | ⚠️ Requires data handling policy |
| SOC 2 | ⚠️ Available with MongoDB Atlas dedicated clusters |
| HIPAA | ⚠️ Requires additional configuration |

---

## 8. Support & Maintenance

### 8.1 Included Support

| Item | Description |
|------|-------------|
| Bug Fixes | Critical bug fixes for 90 days post-launch |
| Security Updates | Security patches as needed |
| Documentation | User guides and admin documentation |

### 8.2 Optional Ongoing Support

| Package | Description | Monthly Cost |
|---------|-------------|--------------|
| Basic | Email support, 48hr response | $200/mo |
| Standard | Email + chat, 24hr response, monthly maintenance | $500/mo |
| Premium | Priority support, 4hr response, weekly maintenance | $1,000/mo |
| Enterprise | Dedicated support, 1hr response, 24/7 monitoring | Custom |

---

## 9. Recommendations

### 9.1 Recommended Starting Configuration

For an organization planning to onboard many members, we recommend:

**Growth Tier with Professional Upgrades**

| Service | Recommendation | Cost |
|---------|----------------|------|
| Frontend | Vercel Pro | $20/mo |
| Backend | DigitalOcean 4GB Droplet | $24/mo |
| Database | MongoDB M10 | $57/mo |
| Voice/Video | Agora Pay-as-you-go | ~$50/mo |
| Media | Cloudinary Plus | $99/mo |
| Email | Brevo Starter | $25/mo |
| Backups | DigitalOcean Backups | $5/mo |
| **Total** | | **$280/mo** |

**Annual Investment:** $3,360/year

This configuration can comfortably handle **5,000-8,000 active members** with room to scale.

### 9.2 Cost Optimization Tips

1. **Start with Growth tier** and upgrade as needed
2. **Monitor Agora usage** - encourage audio calls over video to reduce costs
3. **Optimize images** before upload to reduce Cloudinary usage
4. **Use email batching** to maximize Brevo limits
5. **Review usage monthly** and adjust plans accordingly

---

## 10. Terms & Conditions

### 10.1 Payment Terms

- All third-party services billed directly by respective providers
- Monthly billing (most services)
- Annual billing available for discounts (10-20% savings)

### 10.2 Service Level Agreements

| Provider | Uptime SLA |
|----------|------------|
| Vercel Pro | 99.99% |
| DigitalOcean | 99.99% |
| MongoDB Atlas (M10+) | 99.95% |
| Agora | 99.9% |
| Cloudinary | 99.9% |

### 10.3 Cancellation Policy

- All services are month-to-month (no long-term contracts required)
- Can upgrade or downgrade at any time
- Data export available upon request

---

## Appendix A: Quick Reference Card

### Monthly Cost Summary

| Members | Recommended Tier | Monthly Cost | Annual Cost |
|---------|------------------|--------------|-------------|
| < 500 | Starter | $1 | $12 |
| 500-2,500 | Growth | $113 | $1,356 |
| 2,500-10,000 | Professional | $371 | $4,452 |
| 10,000-50,000 | Enterprise | $958 | $11,496 |

### Service Provider Accounts Needed

1. **Vercel** - vercel.com (Frontend)
2. **DigitalOcean** - digitalocean.com (Backend)
3. **MongoDB Atlas** - mongodb.com/atlas (Database)
4. **Agora** - agora.io (Voice/Video)
5. **Cloudinary** - cloudinary.com (Media)
6. **Brevo** - brevo.com (Email)
7. **Domain Registrar** - namecheap.com or similar

---

## Appendix B: Environment Variables Reference

The following configuration values are required for deployment:

```
# Database
MONGO_URI=mongodb+srv://[username]:[password]@[cluster].mongodb.net/[database]

# Authentication
JWT_SECRET=[secure-random-string]

# Email Service (Brevo)
BREVO_API_KEY=[your-brevo-api-key]
EMAIL_FROM_ADDRESS=[your-email@domain.com]
EMAIL_FROM_NAME=[Your Platform Name]

# Media Storage (Cloudinary)
CLOUDINARY_CLOUD_NAME=[your-cloud-name]
CLOUDINARY_API_KEY=[your-api-key]
CLOUDINARY_API_SECRET=[your-api-secret]

# Voice/Video (Agora)
AGORA_APP_ID=[your-app-id]
AGORA_APP_CERTIFICATE=[your-app-certificate]

# Application
PUBLIC_APP_URL=https://[your-domain.com]
PORT=3000
```

---

## Contact Information

**For questions about this proposal:**

[Your Name]
[Your Company]
[Email Address]
[Phone Number]

---

*This proposal is valid for 30 days from the date of issue.*

*Prices are estimates based on current provider pricing and may vary based on actual usage.*
