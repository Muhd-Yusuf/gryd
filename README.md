# GRYD - Community Communication Platform

A powerful, scalable community communication platform designed for credit unions and member-based organizations. GRYD provides real-time messaging, voice/video calls, and comprehensive community management features.

## Features

### Communication
- **Real-time Messaging** - Instant text messaging with WhatsApp-style UI
- **Voice & Video Calls** - HD quality calls powered by Agora
- **Voice Messages** - Record and send audio messages
- **Direct Messages** - Private 1-on-1 conversations
- **Group Channels** - Organized community discussions

### Social Features
- **Posts & Feed** - Share updates with likes, comments, and reshares
- **Events & Announcements** - Create and manage community events
- **User Presence** - Online/offline status indicators
- **Typing Indicators** - Real-time typing notifications

### Content & Media
- Image uploads and file sharing
- Profile pictures and avatars
- Community logos and branding
- Voice message playback

### User Management
- **Multi-tenant Architecture** - Support unlimited communities
- **Role-based Access Control** - Super Admin, CU Admin, Stakeholders, Members
- **Passwordless Authentication** - Secure OTP-based login via email
- **Invite System** - Email invites for stakeholders, invite codes for members
- **Verified Badges** - Stakeholder verification badges

## Project Structure

```
gryd/
├── backend/
│   └── api-gateway/          # Node.js + Express API
│       ├── src/
│       │   ├── controllers/  # Route handlers
│       │   ├── services/     # Business logic & models
│       │   └── routes/       # API routes
│       └── package.json
│
├── frontend/
│   └── ios-app-new/          # React Native + Expo (Web & Mobile)
│       ├── app/              # Expo Router pages
│       │   ├── (main)/       # Member views
│       │   ├── admin/        # CU Admin dashboard
│       │   └── super-admin/  # Super Admin dashboard
│       ├── components/       # Reusable components
│       ├── contexts/         # React contexts (Auth, Call, WebSocket)
│       ├── hooks/            # Custom React hooks
│       └── lib/              # Utilities and API client
│
└── docs/                     # Documentation
```

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (multi-tenant)
- **Real-time**: Socket.IO
- **Voice/Video**: Agora SDK
- **File Storage**: Cloudinary
- **Email**: SendGrid

### Frontend
- **Framework**: React Native + Expo
- **Navigation**: Expo Router
- **Styling**: React Native StyleSheet
- **Icons**: Lucide React Native, Material Icons
- **State**: React Context + Hooks

## User Roles

| Role | Description |
|------|-------------|
| **Super Admin** | Platform owner with full access to all communities |
| **CU Admin** | Credit Union administrator managing their community |
| **Stakeholder** | VIP users (vendors, partners, sponsors) with verified badges |
| **Member** | Regular community members |

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB
- Agora Account (for voice/video)
- SendGrid Account (for emails)
- Cloudinary Account (for file uploads)

### Backend Setup

```bash
cd backend/api-gateway
npm install
cp .env.example .env
# Configure environment variables
npm run dev
```

### Frontend Setup

```bash
cd frontend/ios-app-new
npm install
cp .env.example .env
# Configure environment variables
npx expo start
```

## Environment Variables

### Backend
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/gryd
JWT_SECRET=your-secret-key
SENDGRID_API_KEY=your-sendgrid-key
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-certificate
```

### Frontend
```env
EXPO_PUBLIC_API_URL=http://localhost:4000/api
EXPO_PUBLIC_AGORA_APP_ID=your-agora-app-id
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/send-otp` - Send OTP for login
- `POST /api/auth/verify-otp` - Verify OTP and get token

### Community
- `GET /api/community/subgrids` - List communities
- `POST /api/community/subgrids/:id/messages` - Send message
- `GET /api/community/subgrids/:id/channels` - List channels
- `POST /api/community/subgrids/:id/events` - Create event

### Users
- `GET /api/users/me` - Get current user
- `PATCH /api/users/me` - Update profile

## Documentation

- [Client Handover Document](GRYD_Client_Handover_Document.md)
- [Setup Guide](GRYD_Setup_Guide_Complete.md)
- [User Walkthrough](GRYD_User_Walkthrough_Guide.md)
- [Infrastructure Proposal](GRYD_Infrastructure_Proposal.md)
- [Cost Summary](GRYD_Cost_Summary.md)

## License

Proprietary - All rights reserved.
