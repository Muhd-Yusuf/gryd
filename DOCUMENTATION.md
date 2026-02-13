# GRYD Community Communication Platform

## Complete Technical Documentation

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Backend Services](#3-backend-services)
4. [Frontend Applications](#4-frontend-applications)
5. [Database Schemas](#5-database-schemas)
6. [API Reference](#6-api-reference)
7. [Authentication System](#7-authentication-system)
8. [Real-Time Communication](#8-real-time-communication)
9. [Features & Functionality](#9-features--functionality)
10. [Environment Configuration](#10-environment-configuration)
11. [Deployment Guide](#11-deployment-guide)
12. [Embedding Guide](#12-embedding-guide-webapp-integration)

---

## 1. Overview

### What is GRYD?

GRYD is a comprehensive, multi-tenant community communication platform designed for credit unions and member-based organizations. It enables real-time messaging, voice/video calls, content sharing, and community management.

### Key Capabilities

- **Real-Time Messaging** - Instant text, emoji, sticker, and media messaging
- **Voice & Video Calls** - 1-on-1 and group calls powered by Agora SDK
- **Multi-Tenant Architecture** - Complete data isolation per customer
- **Role-Based Access Control** - Super Admin, CU Admin, Stakeholders, Members
- **Content Moderation** - Automated filtering with admin review queue
- **Cross-Platform** - iOS, Android, and Web support via React Native/Expo
- **Embeddable Widget** - Integrate communities into existing applications

### Target Users

| Role | Description |
|------|-------------|
| **Super Admin** | Platform administrators managing all tenants |
| **CU Admin** | Credit Union administrators managing their communities |
| **Stakeholder** | Verified VIP members (vendors, partners, sponsors) |
| **Moderator** | Content moderation privileges |
| **Member** | Regular community participants |

---

## 2. Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT APPLICATIONS                            │
├───────────────────┬───────────────────┬─────────────────────────────────┤
│   Mobile App      │    Web App        │      Embedded Widget            │
│ (React Native)    │   (React/Vite)    │   (Web Component/iframe)        │
│   iOS/Android     │                   │                                 │
└─────────┬─────────┴─────────┬─────────┴──────────────┬──────────────────┘
          │                   │                        │
          │              REST API / WebSocket          │
          │                   │                        │
          └───────────────────┼────────────────────────┘
                              │
┌─────────────────────────────┴─────────────────────────────────────────┐
│                         BACKEND (Node.js/Express)                      │
├────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   Routes    │  │ Controllers │  │  Services   │  │ Middleware  │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
├────────────────────────────────────────────────────────────────────────┤
│                          Socket.io (WebSocket)                         │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────┴─────────┐   ┌────────┴────────┐   ┌─────────┴─────────┐
│   MongoDB Atlas   │   │    Cloudinary   │   │      Agora        │
│  (Main + Tenant)  │   │  (File Storage) │   │   (Voice/Video)   │
└───────────────────┘   └─────────────────┘   └───────────────────┘
          │
          ├── Main DB: Users, Tenants, Subgrids, Memberships
          └── Tenant DBs: Channels, Messages, Posts, DMs (per tenant)
```

### Repository Structure

```
gryd/
├── backend/
│   └── api-gateway/
│       └── src/
│           ├── config/          # Feature flags, configuration
│           ├── controllers/     # Request handlers
│           ├── middleware/      # Auth, access control, embed
│           ├── models/          # MongoDB schemas
│           ├── routes/          # API endpoint definitions
│           ├── services/        # Business logic & integrations
│           └── utils/           # Helper functions
│
├── frontend/
│   ├── ios-app-new/             # React Native + Expo (Primary)
│   │   ├── app/                 # File-based routing (Expo Router)
│   │   ├── components/          # Reusable UI components
│   │   ├── contexts/            # React Context providers
│   │   ├── hooks/               # Custom React hooks
│   │   └── lib/                 # Utilities & API client
│   │
│   └── web-app/                 # React + Vite (Secondary)
│       └── src/
│           ├── components/
│           ├── pages/
│           ├── embed/           # Embed widget code
│           └── lib/
│
├── DOCUMENTATION.md             # This file
├── PRD.md                       # Product requirements
└── vercel.json                  # Deployment config
```

### Multi-Tenant Data Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MAIN DATABASE                                 │
├─────────────────────────────────────────────────────────────────────┤
│  users              │ All platform users                            │
│  tenants            │ Organizations (Credit Unions)                 │
│  tenantmemberships  │ User ↔ Tenant relationships                   │
│  subgrids           │ Communities within tenants                    │
│  subgridmemberships │ User ↔ Subgrid relationships                  │
│  invitelinks        │ Invite tokens for all types                   │
│  customroles        │ Custom role definitions                       │
│  notifications      │ In-app notifications                          │
│  calls              │ Call history records                          │
│  filemetadata       │ File upload tracking                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                 TENANT DATABASE (per tenant)                         │
├─────────────────────────────────────────────────────────────────────┤
│  channels           │ Text, voice, announcement channels            │
│  messages           │ Channel messages with media                   │
│  posts              │ Feed posts                                    │
│  comments           │ Post/message comments                         │
│  directmessages     │ 1-on-1 private messages                       │
│  friendships        │ Friend relationships                          │
│  friendblocks       │ Blocked users                                 │
│  reactions          │ Emoji reactions                               │
│  moderationflags    │ Content flags for review                      │
│  auditlogs          │ Moderation action history                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend Services

### Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 18+ |
| Framework | Express.js | 5.2.1 |
| Database | MongoDB | 9.1.1 (Mongoose) |
| Real-Time | Socket.io | 4.7.4 |
| Auth | JWT | jsonwebtoken 9.0.2 |
| Video/Audio | Agora SDK | agora-token 2.0.5 |
| Email | Brevo/SendGrid/SMTP | - |
| File Storage | Cloudinary, AWS S3 | - |
| Push Notifications | Firebase, Expo | - |

### Controllers Overview

| Controller | Purpose | Key Functions |
|------------|---------|---------------|
| `authController.js` | Authentication | signup, login, OTP, stakeholder invites |
| `communityController.js` | Community features | channels, messages, posts, DMs, moderation |
| `superAdminController.js` | Platform admin | tenant management, user management |
| `mediaController.js` | File handling | upload, download, stream, delete |
| `notificationController.js` | Notifications | list, read, register device |
| `customRoleController.js` | Custom roles | create, assign, manage |
| `adminController.js` | CU admin functions | community settings |
| `billingController.js` | Subscriptions | plans, billing |

### Services Overview

| Service | Purpose |
|---------|---------|
| `websocketService.js` | Real-time messaging, presence, typing indicators |
| `callService.js` | Agora voice/video integration |
| `callSignalingService.js` | Call negotiation & signaling |
| `emailService.js` | Email sending (multi-provider) |
| `pushNotificationService.js` | Firebase/Expo push |
| `contentFilterService.js` | Prohibited word filtering |
| `fileUploadService.js` | Cloudinary/S3 uploads |
| `tenantModels.js` | Dynamic tenant DB models |
| `permissionService.js` | Role-based access |
| `tenantDb.js` | Multi-tenant DB connections |

### Middleware Stack

```javascript
// Request processing order
1. CORS (cors)
2. JSON Body Parser (express.json)
3. Static Files (express.static)
4. Feature Flags (featureFlags)
5. Auth Context (attachUserContext)
6. Embed Context (attachEmbedContext)
7. Rate Limiting (rateLimitMiddleware)
8. Route-specific middleware (requireUser, loadSubgrid, etc.)
```

---

## 4. Frontend Applications

### Mobile/Web App (React Native + Expo)

**Location:** `frontend/ios-app-new/`

#### App Structure

```
app/
├── index.tsx              # Landing/splash
├── login.tsx              # Login UI
├── super-admin-signup.tsx # Super admin registration
│
├── auth/                  # Authentication flows
│   ├── login.tsx
│   ├── admin-login.tsx
│   ├── member-signup/
│   ├── join/
│   └── stakeholder-signup/
│
├── (main)/                # Member screens
│   ├── index.tsx          # Main dashboard (152KB)
│   ├── sub-channel.tsx    # Channel messaging (121KB)
│   ├── voice-channel.tsx  # Voice/video calls
│   ├── profile.tsx        # User profile
│   ├── notifications.tsx  # Notification center
│   └── direct-messages/   # DM interface
│
├── admin/                 # CU Admin screens
│   └── index.tsx
│
└── super-admin/           # Platform admin screens
    └── index.tsx
```

#### Key Components

| Component | Size | Purpose |
|-----------|------|---------|
| `SuperAdminDashboard.tsx` | 216KB | Platform administration |
| `CreditUnionAdminScreen.tsx` | 517KB | CU admin dashboard |
| `DirectMessagesScreen.tsx` | 143KB | Direct messaging |
| `TopContributorsScreen.tsx` | 46KB | Leaderboard |
| `CallModal.tsx` | - | Voice/video call UI |
| `Sidebar.tsx` | - | Navigation |
| `ResponsiveLayout.tsx` | - | Responsive wrapper |

#### Context Providers

```typescript
// App-wide state management
<WebSocketProvider>      // Real-time connection
  <CallProvider>         // Voice/video calls
    <NotificationProvider>  // Notifications
      <ToastProvider>    // Toast messages
        <App />
      </ToastProvider>
    </NotificationProvider>
  </CallProvider>
</WebSocketProvider>
```

### Web App (React + Vite)

**Location:** `frontend/web-app/`

Secondary web application with Tailwind CSS styling, primarily used for the embed widget development.

---

## 5. Database Schemas

### User Schema

```javascript
{
  firstName: String,
  lastName: String,
  username: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true },
  password: String, // bcrypt hashed
  role: {
    type: String,
    enum: ['member', 'stakeholder', 'admin', 'super_admin'],
    default: 'member'
  },
  stakeholderBadge: {
    type: String,
    enum: ['stakeholder', 'vendor', 'partner', 'sponsor', 'investor']
  },
  avatarUrl: String,
  bannerUrl: String,
  pushTokens: [String], // Multi-device support
  notificationPreferences: {
    messages: { type: Boolean, default: true },
    dms: { type: Boolean, default: true },
    calls: { type: Boolean, default: true },
    mentions: { type: Boolean, default: true },
    invites: { type: Boolean, default: true }
  },
  defaultTenantId: ObjectId,
  setupToken: String,
  status: { type: String, default: 'active' },
  isPlatformTeamMember: Boolean,
  createdAt: { type: Date, default: Date.now }
}
```

### Subgrid (Community) Schema

```javascript
{
  tenantId: { type: ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true },
  slug: String,
  description: String,
  clientName: String,
  logoUrl: String,
  coverImageUrl: String,
  visibility: { type: String, enum: ['private', 'public'], default: 'private' },
  status: { type: String, enum: ['active', 'suspended', 'archived'], default: 'active' },
  settings: {
    postsEnabled: { type: Boolean, default: true },
    commentsEnabled: { type: Boolean, default: true },
    directMessagesEnabled: { type: Boolean, default: true }
  },
  joinSettings: {
    type: String,
    enum: ['invite_only', 'invite_link', 'auto_join'],
    default: 'invite_only'
  },
  contentModeration: {
    enabled: { type: Boolean, default: false },
    prohibitedWords: [String],
    action: { type: String, enum: ['block', 'censor', 'flag'], default: 'flag' },
    blockedMessage: String
  },
  embedSettings: {
    enabled: { type: Boolean, default: false },
    allowedOrigins: [String],
    mode: { type: String, enum: ['readonly', 'full'], default: 'readonly' },
    defaultChannelId: ObjectId
  },
  engagementSettings: {
    joinMessage: String,
    uploadNotice: String,
    emojiReactions: { type: Boolean, default: true }
  },
  inviteCode: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now }
}
```

### Message Schema (Tenant DB)

```javascript
{
  subgridId: { type: ObjectId, required: true },
  channelId: { type: ObjectId, required: true },
  authorId: { type: ObjectId, required: true },
  body: { type: String, required: true },
  kind: {
    type: String,
    enum: ['text', 'emoji', 'sticker', 'audio', 'reshare'],
    default: 'text'
  },
  attachments: [{
    url: String,
    publicId: String,
    resourceType: String,
    format: String,
    width: Number,
    height: Number,
    duration: Number
  }],
  likeCount: { type: Number, default: 0 },
  reshareCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  likedBy: [ObjectId],
  resharedBy: [ObjectId],
  pinnedBy: ObjectId,
  isPinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

---

## 6. API Reference

### Base URL

```
Production: https://your-domain.com/api
Development: http://localhost:5000/api
```

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/login` | Email/password login |
| GET | `/auth/me` | Get current user |
| PUT | `/auth/password` | Change password |
| POST | `/auth/send-otp` | Request OTP email |
| POST | `/auth/verify-otp` | Verify OTP |
| POST | `/auth/signup-member` | Register via OTP |
| POST | `/auth/login-otp-request` | Request login OTP |
| POST | `/auth/login-otp-verify` | Verify login OTP |
| POST | `/auth/invite-stakeholder` | Invite stakeholder |
| GET | `/auth/validate-code/:code` | Validate invite code |
| GET | `/auth/my-subgrids` | Get user's communities |
| POST | `/auth/signup-super-admin` | Register super admin |

### Community Endpoints

#### Subgrid Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/community/tenants/:tenantId/subgrids` | Create subgrid |
| GET | `/community/tenants/:tenantId/subgrids` | List subgrids |
| GET | `/community/subgrids/:subgridId` | Get subgrid details |
| PATCH | `/community/subgrids/:subgridId` | Update subgrid |
| POST | `/community/subgrids/:subgridId/members` | Add member |
| GET | `/community/subgrids/:subgridId/members` | List members |
| GET | `/community/subgrids/:subgridId/my-role` | Get user's role |

#### Channels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/community/subgrids/:subgridId/channels` | List channels |
| POST | `/community/subgrids/:subgridId/channels` | Create channel |
| PATCH | `/community/subgrids/:subgridId/channels/:channelId` | Update channel |
| DELETE | `/community/subgrids/:subgridId/channels/:channelId` | Delete channel |

#### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/community/subgrids/:subgridId/messages` | List messages |
| POST | `/community/subgrids/:subgridId/messages` | Send message |
| DELETE | `/community/subgrids/:subgridId/messages/:messageId` | Delete message |
| POST | `/community/subgrids/:subgridId/messages/:messageId/like` | Like message |
| DELETE | `/community/subgrids/:subgridId/messages/:messageId/like` | Unlike |
| POST | `/community/subgrids/:subgridId/messages/:messageId/reshare` | Reshare |
| GET | `/community/subgrids/:subgridId/messages/:messageId/comments` | Get comments |
| POST | `/community/subgrids/:subgridId/messages/:messageId/comments` | Add comment |

#### Direct Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/community/subgrids/:subgridId/direct-messages` | List DMs |
| POST | `/community/subgrids/:subgridId/direct-messages` | Send DM |
| DELETE | `/community/subgrids/:subgridId/direct-messages/:dmId` | Delete DM |

#### Invites & Embeds

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/community/subgrids/:subgridId/invites` | Create invite |
| GET | `/community/subgrids/:subgridId/invites` | List invites |
| POST | `/community/subgrids/:subgridId/invites/email` | Email invite |
| POST | `/community/subgrids/:subgridId/invites/accept` | Accept invite |
| POST | `/community/subgrids/:subgridId/embed-token` | Generate embed token |

### Super Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/super-admin/overview` | Dashboard overview |
| GET | `/super-admin/customers` | List tenants |
| POST | `/super-admin/customers` | Create tenant |
| GET | `/super-admin/customers/:customerId` | Get tenant |
| PATCH | `/super-admin/customers/:customerId` | Update tenant |
| GET | `/super-admin/users` | List all users |
| GET | `/super-admin/team` | List team members |
| POST | `/super-admin/team/invite` | Invite team member |

### Media Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/media/upload` | Upload file |
| GET | `/media/download/:fileId` | Download file |
| POST | `/media/stream/:fileId` | Stream media |
| DELETE | `/media/files/:fileId` | Delete file |

### Request/Response Examples

#### Login with OTP

```bash
# Request OTP
POST /api/auth/login-otp-request
Content-Type: application/json

{
  "email": "user@example.com"
}

# Response
{
  "message": "OTP sent to your email"
}

# Verify OTP
POST /api/auth/login-otp-verify
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

#### Send Message

```bash
POST /api/community/subgrids/:subgridId/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "channelId": "channel_id_here",
  "body": "Hello everyone!",
  "kind": "text",
  "attachments": []
}

# Response
{
  "_id": "...",
  "subgridId": "...",
  "channelId": "...",
  "authorId": "...",
  "body": "Hello everyone!",
  "kind": "text",
  "likeCount": 0,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

## 7. Authentication System

### Authentication Methods

#### 1. OTP-Based (Recommended)

```
User Email → Backend sends OTP → User enters OTP → JWT issued
```

- 6-digit OTP sent via email
- Valid for 10 minutes
- Max 5 verification attempts
- Works for signup and login

#### 2. Invite Code

```
Admin creates code → Member enters code → Account created
```

- 6-character alphanumeric code
- Unique per subgrid
- Configurable expiration

#### 3. Email Invite

```
Admin sends invite → User receives email → User clicks link → Account created
```

- Token-based secure links
- Role pre-assigned (member, stakeholder)
- Single use

#### 4. Password (Legacy)

```
Email + Password → JWT issued
```

- bcrypt hashed (salt: 10)
- Password reset via email

### JWT Token Structure

```javascript
{
  "userId": "user_object_id",
  "email": "user@example.com",
  "role": "member",
  "iat": 1705312200,
  "exp": 1705917000
}
```

- **Expiration:** 7 days (configurable)
- **Header format:** `Authorization: Bearer <token>`
- **Alternative:** `x-user-id` and `x-user-role` headers for SSE

### Role Hierarchy

```
super_admin
    └── admin (tenant level)
            └── subgrid_admin
                    └── moderator
                            └── stakeholder
                                    └── member
```

---

## 8. Real-Time Communication

### WebSocket Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-subgrid` | `{ subgridId }` | Join subgrid room |
| `leave-subgrid` | `{ subgridId }` | Leave subgrid room |
| `typing` | `{ subgridId, channelId, userId }` | User typing indicator |
| `stop-typing` | `{ subgridId, channelId, userId }` | Stop typing |
| `presence-update` | `{ subgridId, userId, status }` | Update presence |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `new-message` | `{ message }` | New channel message |
| `new-dm` | `{ message }` | New direct message |
| `message-deleted` | `{ messageId }` | Message deleted |
| `user-typing` | `{ userId, channelId }` | Someone typing |
| `user-stopped-typing` | `{ userId, channelId }` | Stopped typing |
| `presence-changed` | `{ userId, status }` | User status changed |
| `member-joined` | `{ user }` | New member joined |
| `member-left` | `{ userId }` | Member left |
| `incoming-call` | `{ callData }` | Incoming call |
| `call-ended` | `{ callId }` | Call ended |

### WebSocket Connection

```javascript
// Client connection
import { io } from 'socket.io-client';

const socket = io('https://your-api.com', {
  auth: {
    token: 'your-jwt-token'
  },
  transports: ['websocket', 'polling']
});

// Join subgrid
socket.emit('join-subgrid', { subgridId: 'your-subgrid-id' });

// Listen for messages
socket.on('new-message', (message) => {
  console.log('New message:', message);
});
```

### Voice/Video Calls (Agora)

```javascript
// Get Agora token from backend
const response = await fetch('/api/community/subgrids/:subgridId/call-token', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    channelName: 'call-channel',
    callType: 'video'
  })
});

const { token: agoraToken, uid } = await response.json();

// Join Agora channel
import AgoraRTC from 'agora-rtc-sdk-ng';

const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
await client.join(AGORA_APP_ID, channelName, agoraToken, uid);
```

---

## 9. Features & Functionality

### Messaging Features

- **Rich Text** - Text with emoji support
- **Media Attachments** - Images, videos, documents
- **Voice Messages** - Record and send audio
- **Reactions** - Emoji reactions on messages
- **Likes & Reshares** - Engagement metrics
- **Comments** - Threaded replies
- **Pinned Messages** - Important message highlighting
- **Message Deletion** - Author and admin can delete

### Community Features

- **Multiple Communities** - Subgrids within tenants
- **Channels** - Text, voice, announcement
- **Categories** - Organize channels
- **Custom Roles** - Admin-defined badges
- **Events** - Community calendar
- **Posts/Feed** - News and updates

### Social Features

- **Friend System** - Send/accept requests
- **Blocking** - Block unwanted users
- **Presence** - Online/offline status
- **Profiles** - Avatar, banner, bio
- **Leaderboards** - Top contributors

### Moderation Features

- **Content Filter** - Prohibited words
- **Flag System** - Report content
- **Moderation Queue** - Admin review
- **Audit Logs** - Action history
- **Member Management** - Mute, suspend, ban

### Notification Features

- **In-App** - Real-time notifications
- **Push** - iOS/Android/Web push
- **Preferences** - Per-type on/off
- **Deep Linking** - Navigate to content

---

## 10. Environment Configuration

### Backend (.env)

```bash
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/gryd

# Security
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d
EMBED_JWT_SECRET=embed-secret-key

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8081

# Email (choose one provider)
BREVO_API_KEY=xkeysib-xxx
# OR
SENDGRID_API_KEY=SG.xxx
# OR
EMAIL_SMTP_HOST=smtp.example.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=user
EMAIL_SMTP_PASS=pass

EMAIL_FROM_ADDRESS=noreply@gryd.com
EMAIL_FROM_NAME=GRYD

# Cloudinary (file storage)
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=xxx

# AWS S3 (backup storage)
AWS_S3_BUCKET=gryd-files
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=xxx

# Agora (voice/video)
AGORA_APP_ID=your-app-id
AGORA_APP_CERTIFICATE=your-certificate

# Firebase (push notifications)
FIREBASE_PROJECT_ID=gryd-app
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@gryd.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# App URLs
PUBLIC_APP_URL=https://thegryd.io

# Features
ENABLED_FEATURES=community,properties,crm,calendar,agents,billing,admin
```

### Frontend (.env)

```bash
# Expo/React Native
EXPO_PUBLIC_API_BASE_URL=http://localhost:5000
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_AGORA_APP_ID=your-agora-app-id

# Web (Vite)
VITE_API_URL=http://localhost:5000/api
```

---

## 11. Deployment Guide

### Prerequisites

- Node.js 18+
- MongoDB Atlas account
- Cloudinary account
- Agora account (for calls)
- Firebase project (for push)
- Email provider account

### Backend Deployment

```bash
# 1. Install dependencies
cd backend/api-gateway
npm install

# 2. Set environment variables
cp .env.example .env
# Edit .env with production values

# 3. Start server
npm start
# Or with nodemon for development
npm run dev
```

### Frontend Deployment (Vercel)

```json
// vercel.json
{
  "framework": null,
  "buildCommand": "cd frontend/ios-app-new && npm install && npx expo export --platform web",
  "outputDirectory": "frontend/ios-app-new/dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Mobile App Build

```bash
# Development
cd frontend/ios-app-new
npx expo start

# Production build
npx expo build:ios
npx expo build:android

# Or with EAS
eas build --platform all
```

---

## 12. Embedding Guide (WebApp Integration)

This section provides complete instructions for embedding the GRYD community into an existing application.

### Overview

GRYD supports embedding communities into external applications via:

1. **iframe Embedding** - Simple, works everywhere
2. **Web Component** - Custom element with token refresh
3. **Deep Link Integration** - Mobile app linking
4. **SDK/API Integration** - Full programmatic control

### Embed Modes

| Mode | Access Level | Use Case |
|------|-------------|----------|
| `readonly` | View messages only | Public community view |
| `full` | Read + Write | Authenticated member access |

### Method 1: iframe Embedding (Simplest)

#### Backend Configuration

First, enable embedding for your subgrid:

```javascript
// PATCH /api/community/subgrids/:subgridId
{
  "embedSettings": {
    "enabled": true,
    "allowedOrigins": ["https://your-app.com", "https://www.your-app.com"],
    "mode": "full",
    "defaultChannelId": "optional-channel-id"
  }
}
```

#### Generate Embed Token

```javascript
// Your backend server
const response = await fetch(`${GRYD_API}/community/subgrids/${subgridId}/embed-token`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'user-id-in-your-system', // Maps to GRYD user
    role: 'member',
    scopes: ['read', 'write']
  })
});

const { token } = await response.json();
```

#### Embed Token Structure

```javascript
// Token payload (15 minute expiry)
{
  tenantId: 'tenant-id',
  subgridId: 'subgrid-id',
  userId: 'user-id',
  role: 'member',
  scopes: ['read', 'write'],
  channelId: 'optional-default-channel',
  embedMode: 'full'
}
```

#### Frontend Implementation

```html
<!-- In your existing app -->
<button id="open-community">Open Community</button>

<div id="community-container" style="display: none;">
  <iframe
    id="gryd-embed"
    src=""
    style="width: 100%; height: 600px; border: none; border-radius: 16px;"
    allow="microphone; camera"
  ></iframe>
</div>

<script>
  const GRYD_URL = 'https://thegryd.io';
  const SUBGRID_ID = 'your-subgrid-id';

  document.getElementById('open-community').addEventListener('click', async () => {
    // Fetch embed token from YOUR backend (which calls GRYD API)
    const response = await fetch('/api/get-community-token');
    const { token } = await response.json();

    // Build iframe URL
    const embedUrl = `${GRYD_URL}/embed/${SUBGRID_ID}?token=${token}`;

    // Load iframe
    document.getElementById('gryd-embed').src = embedUrl;
    document.getElementById('community-container').style.display = 'block';
  });
</script>
```

### Method 2: Web Component (Recommended)

The Web Component provides automatic token refresh and better encapsulation.

#### Installation

```html
<!-- Include the embed script -->
<script type="module">
  import { registerCommunityEmbed } from 'https://thegryd.io/embed/community-embed.js';
  registerCommunityEmbed();
</script>
```

Or install via npm:

```bash
npm install @gryd/embed
```

```typescript
import { registerCommunityEmbed } from '@gryd/embed';
registerCommunityEmbed();
```

#### Usage

```html
<syphor-community-embed id="my-community"></syphor-community-embed>

<script>
  const embed = document.getElementById('my-community');

  // Configure the embed
  embed.setConfig({
    subgridId: 'your-subgrid-id',
    baseUrl: 'https://thegryd.io',
    theme: 'dark', // 'light' or 'dark'
    readonly: false,
    refreshIntervalMs: 10 * 60 * 1000, // 10 minutes

    // Token provider function (called automatically for refresh)
    tokenProvider: async () => {
      const response = await fetch('/api/get-community-token');
      const { token } = await response.json();
      return token;
    }
  });
</script>
```

#### Web Component API

```typescript
interface CommunityEmbedConfig {
  subgridId: string;
  baseUrl?: string;
  tokenProvider?: () => Promise<string>;
  refreshIntervalMs?: number; // Default: 10 minutes
  theme?: 'light' | 'dark';
  readonly?: boolean;
}

// Methods
embed.setConfig(config: CommunityEmbedConfig): void;
embed.refreshToken(): Promise<void>;
```

### Method 3: React/React Native Integration

#### React Web

```tsx
import React, { useEffect, useRef } from 'react';

interface CommunityEmbedProps {
  subgridId: string;
  onTokenRequest: () => Promise<string>;
}

export const CommunityEmbed: React.FC<CommunityEmbedProps> = ({
  subgridId,
  onTokenRequest
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    const fetchToken = async () => {
      const newToken = await onTokenRequest();
      setToken(newToken);
    };

    fetchToken();

    // Refresh token every 10 minutes
    const interval = setInterval(fetchToken, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [onTokenRequest]);

  const embedUrl = token
    ? `https://thegryd.io/embed/${subgridId}?token=${token}`
    : '';

  return (
    <iframe
      ref={iframeRef}
      src={embedUrl}
      style={{
        width: '100%',
        height: '600px',
        border: 'none',
        borderRadius: '16px'
      }}
      allow="microphone; camera"
      title="GRYD Community"
    />
  );
};

// Usage
<CommunityEmbed
  subgridId="your-subgrid-id"
  onTokenRequest={async () => {
    const res = await fetch('/api/get-community-token');
    const { token } = await res.json();
    return token;
  }}
/>
```

#### React Native (WebView)

```tsx
import React, { useState, useEffect } from 'react';
import { View, Button, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface CommunityEmbedProps {
  subgridId: string;
  apiBaseUrl: string;
  userToken: string;
}

export const CommunityEmbed: React.FC<CommunityEmbedProps> = ({
  subgridId,
  apiBaseUrl,
  userToken
}) => {
  const [embedToken, setEmbedToken] = useState<string>('');
  const [visible, setVisible] = useState(false);

  const fetchEmbedToken = async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/community/subgrids/${subgridId}/embed-token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const data = await response.json();
      setEmbedToken(data.token);
    } catch (error) {
      console.error('Failed to fetch embed token:', error);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchEmbedToken();
      // Refresh every 10 minutes
      const interval = setInterval(fetchEmbedToken, 10 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [visible, subgridId]);

  const embedUrl = `https://thegryd.io/embed/${subgridId}?token=${embedToken}`;

  return (
    <View style={styles.container}>
      <Button
        title="Open Community"
        onPress={() => setVisible(true)}
      />

      {visible && embedToken && (
        <View style={styles.webviewContainer}>
          <Button
            title="Close"
            onPress={() => setVisible(false)}
          />
          <WebView
            source={{ uri: embedUrl }}
            style={styles.webview}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            javaScriptEnabled={true}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webviewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
});
```

### Method 4: Mobile Deep Linking

For native mobile apps, you can deep link to the GRYD mobile app or open specific screens.

#### URL Schemes

```
# Open community
gryd://community/{subgridId}

# Open specific channel
gryd://community/{subgridId}/channel/{channelId}

# Open DM with user
gryd://community/{subgridId}/dm/{userId}

# Web fallback (if app not installed)
https://thegryd.io/community/{subgridId}?token={embedToken}
```

#### iOS Implementation (Swift)

```swift
import UIKit

class CommunityIntegration {
    static let shared = CommunityIntegration()

    let grydAppScheme = "gryd://"
    let grydWebURL = "https://thegryd.io"

    func openCommunity(subgridId: String, token: String?) {
        // Try to open native app first
        let appURL = URL(string: "\(grydAppScheme)community/\(subgridId)")!

        if UIApplication.shared.canOpenURL(appURL) {
            UIApplication.shared.open(appURL)
        } else {
            // Fall back to web view
            var webURLString = "\(grydWebURL)/community/\(subgridId)"
            if let token = token {
                webURLString += "?token=\(token)"
            }
            let webURL = URL(string: webURLString)!
            UIApplication.shared.open(webURL)
        }
    }

    func openChannel(subgridId: String, channelId: String) {
        let url = URL(string: "\(grydAppScheme)community/\(subgridId)/channel/\(channelId)")!
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        }
    }
}

// Usage
CommunityIntegration.shared.openCommunity(subgridId: "abc123", token: embedToken)
```

#### Android Implementation (Kotlin)

```kotlin
class CommunityIntegration(private val context: Context) {

    private val grydAppScheme = "gryd://"
    private val grydWebURL = "https://thegryd.io"
    private val grydPackage = "com.gryd.app"

    fun openCommunity(subgridId: String, token: String? = null) {
        val appIntent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("${grydAppScheme}community/$subgridId")
            setPackage(grydPackage)
        }

        if (appIntent.resolveActivity(context.packageManager) != null) {
            context.startActivity(appIntent)
        } else {
            // Fall back to web
            val webUrl = buildString {
                append("$grydWebURL/community/$subgridId")
                token?.let { append("?token=$it") }
            }
            val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse(webUrl))
            context.startActivity(webIntent)
        }
    }

    fun openChannel(subgridId: String, channelId: String) {
        val intent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("${grydAppScheme}community/$subgridId/channel/$channelId")
            setPackage(grydPackage)
        }
        context.startActivity(intent)
    }
}

// Usage
CommunityIntegration(context).openCommunity("abc123", embedToken)
```

### Method 5: Full API Integration

For complete control, integrate directly with the GRYD API.

#### Backend Proxy Setup

```javascript
// your-backend/routes/community.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

const GRYD_API = process.env.GRYD_API_URL;
const GRYD_ADMIN_TOKEN = process.env.GRYD_ADMIN_TOKEN;

// Proxy endpoint for your frontend
router.get('/community/messages', async (req, res) => {
  const { subgridId, channelId } = req.query;
  const userId = req.user.id; // Your app's user ID

  try {
    // Get embed token for this user
    const tokenRes = await axios.post(
      `${GRYD_API}/community/subgrids/${subgridId}/embed-token`,
      { userId, role: 'member', scopes: ['read', 'write'] },
      { headers: { Authorization: `Bearer ${GRYD_ADMIN_TOKEN}` } }
    );

    // Fetch messages
    const messagesRes = await axios.get(
      `${GRYD_API}/community/subgrids/${subgridId}/messages`,
      {
        params: { channelId },
        headers: { Authorization: `Bearer ${tokenRes.data.token}` }
      }
    );

    res.json(messagesRes.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message on behalf of user
router.post('/community/messages', async (req, res) => {
  const { subgridId, channelId, body, attachments } = req.body;
  const userId = req.user.id;

  try {
    const tokenRes = await axios.post(
      `${GRYD_API}/community/subgrids/${subgridId}/embed-token`,
      { userId, role: 'member', scopes: ['read', 'write'] },
      { headers: { Authorization: `Bearer ${GRYD_ADMIN_TOKEN}` } }
    );

    const messageRes = await axios.post(
      `${GRYD_API}/community/subgrids/${subgridId}/messages`,
      { channelId, body, attachments },
      { headers: { Authorization: `Bearer ${tokenRes.data.token}` } }
    );

    res.json(messageRes.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
```

### User Synchronization

When users sign up in your app, sync them to GRYD:

```javascript
// your-backend/services/grydSync.js
const axios = require('axios');

const GRYD_API = process.env.GRYD_API_URL;
const GRYD_ADMIN_TOKEN = process.env.GRYD_ADMIN_TOKEN;

async function syncUserToGRYD(user, subgridId) {
  try {
    // Check if user exists in GRYD
    const existingUser = await axios.get(
      `${GRYD_API}/users/by-email/${encodeURIComponent(user.email)}`,
      { headers: { Authorization: `Bearer ${GRYD_ADMIN_TOKEN}` } }
    ).catch(() => null);

    if (!existingUser) {
      // Create user in GRYD
      const createRes = await axios.post(
        `${GRYD_API}/auth/signup-member`,
        {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          subgridId: subgridId
        },
        { headers: { Authorization: `Bearer ${GRYD_ADMIN_TOKEN}` } }
      );
      return createRes.data.user;
    }

    return existingUser.data;
  } catch (error) {
    console.error('Failed to sync user to GRYD:', error);
    throw error;
  }
}

// Call on user registration
app.post('/register', async (req, res) => {
  // Create user in your system
  const user = await createUser(req.body);

  // Sync to GRYD
  await syncUserToGRYD(user, process.env.GRYD_SUBGRID_ID);

  res.json({ success: true, user });
});
```

### Security Considerations

1. **Token Security**
   - Never expose admin tokens to frontend
   - Generate embed tokens on your backend
   - Tokens expire in 15 minutes - implement refresh

2. **Origin Validation**
   - Configure `allowedOrigins` in embed settings
   - GRYD validates request origins

3. **User Mapping**
   - Map your users to GRYD users via email or ID
   - Consider SSO integration for seamless auth

4. **Scope Limitation**
   - Use `readonly` mode for public views
   - Limit scopes based on user permissions

### Troubleshooting

| Issue | Solution |
|-------|----------|
| iframe not loading | Check `allowedOrigins` includes your domain |
| Token expired | Implement token refresh (10-min interval) |
| CORS errors | Ensure backend proxies requests |
| User not found | Sync users before generating tokens |
| Messages not sending | Verify scopes include `write` |

### Complete Integration Example

```javascript
// your-backend/index.js
const express = require('express');
const axios = require('axios');
const app = express();

const GRYD_API = 'https://api.gryd.com';
const GRYD_ADMIN_TOKEN = process.env.GRYD_ADMIN_TOKEN;
const SUBGRID_ID = process.env.GRYD_SUBGRID_ID;

// Middleware to verify your app's auth
const requireAuth = (req, res, next) => {
  // Your auth logic
  req.user = { id: 'user-123', email: 'user@example.com' };
  next();
};

// Get embed token for authenticated user
app.get('/api/community-token', requireAuth, async (req, res) => {
  try {
    const response = await axios.post(
      `${GRYD_API}/community/subgrids/${SUBGRID_ID}/embed-token`,
      {
        userId: req.user.id,
        role: 'member',
        scopes: ['read', 'write']
      },
      { headers: { Authorization: `Bearer ${GRYD_ADMIN_TOKEN}` } }
    );
    res.json({ token: response.data.token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

app.listen(3000);
```

```html
<!-- your-frontend/index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>My App with Community</title>
  <style>
    .community-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 24px;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
    }
    .community-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
    }
    .community-modal.active {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .community-frame {
      width: 90%;
      max-width: 800px;
      height: 80vh;
      background: white;
      border-radius: 16px;
      overflow: hidden;
    }
    .community-frame iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    .close-button {
      position: absolute;
      top: 20px;
      right: 20px;
      background: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      cursor: pointer;
      font-size: 20px;
    }
  </style>
</head>
<body>
  <h1>My Existing Application</h1>
  <p>Your app content here...</p>

  <!-- Community Button -->
  <button class="community-button" onclick="openCommunity()">
    💬 Community
  </button>

  <!-- Community Modal -->
  <div id="communityModal" class="community-modal">
    <button class="close-button" onclick="closeCommunity()">×</button>
    <div class="community-frame">
      <iframe id="communityFrame" allow="microphone; camera"></iframe>
    </div>
  </div>

  <script>
    const GRYD_URL = 'https://thegryd.io';
    const SUBGRID_ID = 'your-subgrid-id';
    let tokenRefreshInterval;

    async function getToken() {
      const res = await fetch('/api/community-token');
      const data = await res.json();
      return data.token;
    }

    async function openCommunity() {
      const token = await getToken();
      const frame = document.getElementById('communityFrame');
      frame.src = `${GRYD_URL}/embed/${SUBGRID_ID}?token=${token}`;
      document.getElementById('communityModal').classList.add('active');

      // Refresh token every 10 minutes
      tokenRefreshInterval = setInterval(async () => {
        const newToken = await getToken();
        frame.src = `${GRYD_URL}/embed/${SUBGRID_ID}?token=${newToken}`;
      }, 10 * 60 * 1000);
    }

    function closeCommunity() {
      document.getElementById('communityModal').classList.remove('active');
      document.getElementById('communityFrame').src = '';
      clearInterval(tokenRefreshInterval);
    }
  </script>
</body>
</html>
```

---

## 13. Credit Union App Integration Guide

This section provides complete integration instructions for Credit Union developers to embed the GRYD community into their existing mobile apps, regardless of the technology stack used.

### Overview

GRYD can be embedded into **any mobile app** using a WebView component. The integration is simple:

1. Add a "Community" button/tab in your app
2. Open a WebView pointing to `https://thegryd.io`
3. Enable JavaScript and DOM storage
4. Done!

**User Experience:**
- First visit: User enters invite code (provided by CU Admin) → verifies email with OTP → creates profile
- Subsequent visits: Automatic login (token persists in WebView storage)
- Users will think the community is just another feature of your app

### How Authentication Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FIRST TIME:                                                                 │
│  ┌─────────┐    ┌─────────────┐    ┌─────────┐    ┌─────────────────────┐   │
│  │ Tap     │ -> │ Enter Code  │ -> │ Verify  │ -> │ Access Community    │   │
│  │Community│    │ (e.g.ABC123)│    │ Email   │    │ (token saved)       │   │
│  └─────────┘    └─────────────┘    └─────────┘    └─────────────────────┘   │
│                                                                              │
│  RETURNING USER:                                                             │
│  ┌─────────┐    ┌─────────────────────────────────────────────────────────┐ │
│  │ Tap     │ -> │ Directly into Community (auto-login, no code needed!)  │ │
│  │Community│    └─────────────────────────────────────────────────────────┘ │
│  └─────────┘                                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Platform Integration Examples

#### Flutter

```dart
// pubspec.yaml
// dependencies:
//   webview_flutter: ^4.4.2

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class CommunityScreen extends StatefulWidget {
  const CommunityScreen({Key? key}) : super(key: key);

  @override
  State<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends State<CommunityScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            setState(() => _isLoading = true);
          },
          onPageFinished: (String url) {
            setState(() => _isLoading = false);
          },
          onWebResourceError: (WebResourceError error) {
            debugPrint('WebView error: ${error.description}');
          },
        ),
      )
      ..loadRequest(Uri.parse('https://thegryd.io'));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Community'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(),
            ),
        ],
      ),
    );
  }
}

// Usage: Navigate to CommunityScreen when user taps Community button
// Navigator.push(context, MaterialPageRoute(builder: (_) => CommunityScreen()));
```

#### React Native

```tsx
// Install: npm install react-native-webview

import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export const CommunityScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: 'https://thegryd.io' }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}        // Required for localStorage
        sharedCookiesEnabled={true}     // Share cookies with Safari (iOS)
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
});
```

#### Native iOS (Swift)

```swift
import UIKit
import WebKit

class CommunityViewController: UIViewController {

    private var webView: WKWebView!
    private var loadingIndicator: UIActivityIndicatorView!

    override func viewDidLoad() {
        super.viewDidLoad()

        title = "Community"
        view.backgroundColor = .white

        setupWebView()
        setupLoadingIndicator()
        loadCommunity()
    }

    private func setupWebView() {
        // Configure WebView with persistent storage
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // Persists localStorage across sessions
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        view.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func setupLoadingIndicator() {
        loadingIndicator = UIActivityIndicatorView(style: .large)
        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        loadingIndicator.hidesWhenStopped = true
        view.addSubview(loadingIndicator)

        NSLayoutConstraint.activate([
            loadingIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }

    private func loadCommunity() {
        guard let url = URL(string: "https://thegryd.io") else { return }
        webView.load(URLRequest(url: url))
    }
}

extension CommunityViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        loadingIndicator.startAnimating()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loadingIndicator.stopAnimating()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        loadingIndicator.stopAnimating()
        print("WebView error: \(error.localizedDescription)")
    }
}
```

#### Native Android (Kotlin)

```kotlin
// AndroidManifest.xml - Add internet permission:
// <uses-permission android:name="android.permission.INTERNET" />

import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import androidx.appcompat.app.AppCompatActivity

class CommunityActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Create layout programmatically
        val container = android.widget.FrameLayout(this).apply {
            layoutParams = android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        // Setup WebView
        webView = WebView(this).apply {
            layoutParams = android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT
            )

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true          // Required for localStorage
                databaseEnabled = true            // Enable IndexedDB
                cacheMode = WebSettings.LOAD_DEFAULT
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
            }

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    progressBar.visibility = View.GONE
                }
            }

            webChromeClient = WebChromeClient()

            loadUrl("https://thegryd.io")
        }

        // Setup ProgressBar
        progressBar = ProgressBar(this).apply {
            layoutParams = android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.WRAP_CONTENT,
                android.widget.FrameLayout.LayoutParams.WRAP_CONTENT,
                android.view.Gravity.CENTER
            )
        }

        container.addView(webView)
        container.addView(progressBar)
        setContentView(container)

        // Set title
        supportActionBar?.title = "Community"
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
```

#### Ionic / Capacitor

```typescript
// Install: npm install @capacitor/browser
// Or use inline iframe for embedded experience

import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-community',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Community</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-no-padding">
      <div class="loading" *ngIf="loading">
        <ion-spinner name="crescent"></ion-spinner>
      </div>
      <iframe
        [src]="communityUrl"
        (load)="onLoad()"
        allow="microphone; camera"
        class="community-frame">
      </iframe>
    </ion-content>
  `,
  styles: [`
    .community-frame {
      width: 100%;
      height: 100%;
      border: none;
    }
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10;
    }
  `]
})
export class CommunityPage {
  communityUrl: SafeResourceUrl;
  loading = true;

  constructor(private sanitizer: DomSanitizer) {
    this.communityUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://thegryd.io'
    );
  }

  onLoad() {
    this.loading = false;
  }
}
```

#### Xamarin / .NET MAUI

```csharp
using Microsoft.Maui.Controls;

namespace YourApp.Views
{
    public class CommunityPage : ContentPage
    {
        private WebView _webView;
        private ActivityIndicator _loadingIndicator;

        public CommunityPage()
        {
            Title = "Community";

            _webView = new WebView
            {
                Source = new UrlWebViewSource { Url = "https://thegryd.io" },
                HorizontalOptions = LayoutOptions.Fill,
                VerticalOptions = LayoutOptions.Fill
            };

            _loadingIndicator = new ActivityIndicator
            {
                IsRunning = true,
                IsVisible = true,
                Color = Colors.Purple,
                HorizontalOptions = LayoutOptions.Center,
                VerticalOptions = LayoutOptions.Center
            };

            _webView.Navigating += (s, e) =>
            {
                _loadingIndicator.IsVisible = true;
                _loadingIndicator.IsRunning = true;
            };

            _webView.Navigated += (s, e) =>
            {
                _loadingIndicator.IsVisible = false;
                _loadingIndicator.IsRunning = false;
            };

            Content = new Grid
            {
                Children = { _webView, _loadingIndicator }
            };
        }
    }
}
```

#### Cordova / PhoneGap

```javascript
// Install: cordova plugin add cordova-plugin-inappbrowser

document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    // Add click handler to your Community button
    document.getElementById('communityBtn').addEventListener('click', openCommunity);
}

function openCommunity() {
    // Open in-app browser with toolbar
    var ref = cordova.InAppBrowser.open(
        'https://thegryd.io',
        '_blank',
        'location=no,toolbar=yes,toolbarposition=top,closebuttoncaption=Close'
    );

    ref.addEventListener('loadstart', function() {
        console.log('Loading community...');
    });

    ref.addEventListener('loadstop', function() {
        console.log('Community loaded');
    });

    ref.addEventListener('loaderror', function(err) {
        console.error('Error loading community:', err.message);
    });
}
```

### Critical WebView Settings

For the authentication token to persist (so users stay logged in), ensure these settings are enabled:

| Platform | Required Setting | Code |
|----------|-----------------|------|
| **Flutter** | JavaScript enabled | `JavaScriptMode.unrestricted` |
| **React Native** | DOM Storage | `domStorageEnabled={true}` |
| **iOS (Swift)** | Default data store | `.default()` (not `.nonPersistent()`) |
| **Android** | DOM Storage | `settings.domStorageEnabled = true` |
| **Ionic** | (Automatic) | Works by default |
| **Xamarin** | (Automatic) | Works by default |

### What NOT to Do

```
❌ DON'T clear WebView data on close
❌ DON'T use incognito/private mode
❌ DON'T disable JavaScript
❌ DON'T disable DOM storage / localStorage
❌ DON'T use ephemeral/non-persistent data stores
```

### Communication Between App and WebView (Optional)

If you need your app to communicate with the GRYD community (e.g., show notification badges, handle deep links):

#### Sending Messages TO WebView

```javascript
// Flutter
_controller.runJavaScript('window.postMessage({"type": "app_event", "data": {...}}, "*")');

// React Native
webViewRef.current.injectJavaScript('window.postMessage({"type": "app_event"}, "*")');

// Swift
webView.evaluateJavaScript("window.postMessage({type: 'app_event'}, '*')")

// Kotlin
webView.evaluateJavascript("window.postMessage({type: 'app_event'}, '*')", null)
```

#### Receiving Messages FROM WebView

```javascript
// GRYD will post messages for important events
window.parent.postMessage({
    type: 'notification_count',
    count: 5
}, '*');

window.parent.postMessage({
    type: 'user_logged_in',
    userId: '...'
}, '*');
```

#### Flutter - Handle Messages

```dart
_controller.setOnConsoleMessage((message) {
    // Handle console messages if needed
});

// Or use JavaScript channels
_controller.addJavaScriptChannel(
    'GRYDChannel',
    onMessageReceived: (JavaScriptMessage message) {
        final data = jsonDecode(message.message);
        if (data['type'] == 'notification_count') {
            // Update your app's badge
            updateBadge(data['count']);
        }
    },
);
```

#### React Native - Handle Messages

```tsx
<WebView
  onMessage={(event) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'notification_count') {
      // Update your app's badge
      updateBadge(data.count);
    }
  }}
/>
```

### Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| User must login every time | Storage not persisting | Enable `domStorageEnabled` / use default data store |
| Blank white screen | JavaScript disabled | Enable `javaScriptEnabled` |
| Media won't play | User gesture required | Set `mediaPlaybackRequiresUserGesture = false` |
| Page not loading | No internet permission | Add internet permission to manifest |
| Back button exits app | Not handling WebView history | Check `canGoBack()` before exiting |

### Checklist for CU Developers

```
[ ] Add "Community" button/tab to your app navigation
[ ] Implement WebView screen with URL: https://thegryd.io
[ ] Enable JavaScript in WebView settings
[ ] Enable DOM storage / localStorage in WebView settings
[ ] Use persistent (non-ephemeral) data store
[ ] Handle back button navigation within WebView
[ ] (Optional) Add loading indicator
[ ] (Optional) Handle postMessage events for badges/notifications
[ ] Test: First login with invite code
[ ] Test: Close app, reopen - should auto-login
```

### Summary

| Question | Answer |
|----------|--------|
| What technology can I use? | Any! Flutter, React Native, Swift, Kotlin, Ionic, Xamarin, Cordova, etc. |
| How long to integrate? | 5-15 minutes |
| Does user login every time? | No, token persists in WebView storage |
| Do I need to modify my backend? | No |
| Do I need API keys? | No |
| What URL do I load? | `https://thegryd.io` |

---

## Support

For technical support or questions:
- GitHub Issues: https://github.com/gryd/gryd-platform/issues
- Documentation: https://docs.gryd.com
- Email: support@gryd.com

---

*Documentation generated for GRYD Community Platform v1.0*
