# MASTER BUILD PROMPT: AI-Powered Real Estate Marketing & Lead Automation Platform

## Role & Objective
You are a senior full-stack software architect and engineer. Your task is to design and implement a production-ready, scalable, and secure AI-powered real estate platform for real estate agents, teams, and brokerages.

The platform must enable realtors to instantly generate property landing pages, automatically capture and qualify leads using AI agents, manage all leads in a CRM, and handle subscriptions and billing. The system must prioritize speed, automation, reliability, and regulatory compliance.

## Core Business Goal
Reduce the daily manual workload of real estate agents by automating property marketing and lead follow-up, while increasing lead conversion rates through AI-driven engagement.

## Target Users
- Individual Realtors
- Real Estate Teams
- Brokerages

Users should be able to onboard in under 15 minutes and generate their first property landing page in under 60 seconds.

## Technology Stack (Mandatory)
### Frontend
- React (Web application and mobile)
- TypeScript
- Tailwind CSS
- React Query or SWR
- React Router
- Responsive, mobile-first design

### Backend
- Node.js with Express or Fastify
- RESTful APIs
- MongoDB for persistent storage
- Redis for caching, rate limiting, and queues
- JWT-based authentication
- Role-based access control

### AI & Automation
- OpenAI or Anthropic APIs
- AI-generated property descriptions
- AI-powered email, SMS, and voice agents
- Lead qualification logic
- Conversation summarization

### Integrations
- Twilio for calls and SMS
- SendGrid for email
- Plaid for ACH payments
- MLS APIs (user-provided credentials)

### Infrastructure
- Dockerized services
- AWS or GCP
- CI/CD pipeline
- Environment-based configuration
- Logging and monitoring

## Core Features to Build
### 1. AI Property Landing Page Generator
Purpose: Convert MLS listings to professional landing pages instantly.

Functionality:
- Import from MLS API or manual entry
- AI-generated property descriptions
- SEO optimization
- Mobile-responsive templates
- One-click publishing

User Flow:
1. Enter MLS ID or property details
2. AI generates content and suggests layout
3. User customizes if needed
4. Publish to unique URL
5. Track visitor engagement

### 2. Lead Capture & CRM System
Purpose: Centralize all lead interactions and automate follow-ups.

Features:
- Contact database with full history
- Lead scoring algorithm
- Pipeline management
- Automated task creation
- Email/SMS campaign tools

Lead Lifecycle:
New Lead -> Qualification -> Nurturing -> Active Buyer -> Closed

### 3. AI Communication Agents
Purpose: Automate initial lead engagement across all channels.

Phone Agent:
- Voice cloning from user samples
- TCPA-compliant calling
- Appointment scheduling
- Lead qualification scripts

Email/SMS Agents:
- Personalized messaging
- Automated follow-up sequences
- Response detection
- Conversation continuity

All outbound communication must log consent and follow TCPA rules.

### 4. Community Platform
Purpose: Enable knowledge sharing and peer learning.

Features:
- Discussion forums
- Achievement badges
- Best practices sharing
- Template marketplace
- User rankings

### 4a. Subgrid (Sub-Community) System
Subgrids are isolated community spaces nested under a tenant (realtor account/team).

Core requirements:
- Create subgrids with name, description, logo, cover image, client/partner label.
- Default private visibility; status: active/suspended/archived.
- Scoped roles: subgrid_admin, moderator, member.
- Per-subgrid settings: posts, comments, direct messages on/off.
- Join methods: invite-only, invite link, auto-join.
- Embedding support with token-based auth (read-only by default).
- Strict data isolation between subgrids.
- Dedicated subgrid admin dashboard (members, channels, moderation, analytics, embed settings).

#### Subgrid Features (Functional Scope)
- Member management: list/search/filter, invite, remove, suspend/mute, role assignment.
- Channels: create/edit/archive, public or admin-only.
- Content: posts, comments, reactions, messages, attachments, rich text.
- Moderation: flagging, queue review, approve/remove/warn/mute/ban.
- Audit log for moderation actions.
- Analytics: members, active members, channels, messages, posts, comments, flagged content, trends.
- Notifications: mentions, replies, announcements; admin alerts for flags and joins.

#### Embed Support
- Generate embed URL per subgrid and optionally per channel.
- Embed token supports refresh hook and channel scope.
- Optional allowed origin list.

#### Permission Boundaries
- All API access is validated per subgrid membership and role.
- Admins only see their own subgrid.
- Moderators only moderate content inside their subgrid.

#### Data Isolation Model
- MongoDB per tenant (separate DB name per tenant).
- Subgrid data stored and queried by subgridId within tenant DB.
- Global control plane collections for tenants, subgrids, memberships, and invites.

#### Primary Mongo Collections
Control plane:
- tenants
- tenant_memberships
- subgrids
- subgrid_memberships
- invite_links

Tenant DB (per tenant):
- channels
- messages
- posts
- comments
- reactions
- direct_messages
- moderation_flags
- audit_logs
- notifications

#### Community API Surface (High Level)
Tenant admin:
- POST /api/community/tenants
- POST /api/community/tenants/:tenantId/members
- POST /api/community/tenants/:tenantId/subgrids
- GET /api/community/tenants/:tenantId/subgrids

Subgrid admin:
- GET/PATCH /api/community/subgrids/:subgridId
- POST/GET /api/community/subgrids/:subgridId/members
- PATCH/DELETE /api/community/subgrids/:subgridId/members/:userId
- POST/GET /api/community/subgrids/:subgridId/invites
- POST /api/community/subgrids/:subgridId/invites/:inviteId/revoke

Subgrid content:
- GET/POST /api/community/subgrids/:subgridId/channels
- PATCH /api/community/subgrids/:subgridId/channels/:channelId
- GET/POST /api/community/subgrids/:subgridId/messages
- GET/POST /api/community/subgrids/:subgridId/posts
- GET/POST /api/community/subgrids/:subgridId/posts/:postId/comments
- POST /api/community/subgrids/:subgridId/reactions
- DELETE /api/community/subgrids/:subgridId/reactions
- GET/POST /api/community/subgrids/:subgridId/direct-messages

Moderation + analytics:
- GET /api/community/subgrids/:subgridId/moderation
- POST /api/community/subgrids/:subgridId/moderation/:flagId/action
- GET /api/community/subgrids/:subgridId/audit-log
- GET /api/community/subgrids/:subgridId/analytics

Embedding + notifications:
- POST /api/community/subgrids/:subgridId/embed-token
- POST /api/community/subgrids/:subgridId/invites/accept
- GET /api/community/subgrids/:subgridId/notifications
- POST /api/community/subgrids/:subgridId/notifications/:notificationId/read

### 5. Payments & Billing
Purpose: Handle subscriptions and usage-based billing.

Implementation:
- Plaid ACH integration (avoid credit card fees)
- Usage tracking for AI costs
- Transparent billing dashboard
- Automated invoicing

## User Flow
### Onboarding
- Account creation
- Business profile setup
- MLS API connection
- Branding setup
- AI preferences
- Create first landing page

### Daily Workflow
- View dashboard
- Review new leads
- AI handles first contact
- Realtor follows up on qualified leads
- Generate new landing pages
- Track performance metrics

## Security & Compliance
- TCPA compliance for all communications
- Explicit opt-in before outreach
- Data encryption in transit and at rest
- Multi-tenant data isolation
- Audit logs for AI actions
- GDPR and CCPA considerations

## Performance & Quality Requirements
- Landing page generation under 60 seconds
- 99.9% uptime
- scalable to thousands of users
- Unit, integration, and end-to-end tests
- Error handling and fallback strategies

## Deliverables
- React web application
- Backend API services
- AI integration services
- Database schema
- Deployment configuration
- Technical documentation
- User documentation

## Project Structure
### Frontend Layer
```
├── Web App (React)
├── iOS App (React)
└── Admin Dashboard
```

### Backend Layer
```
├── API Gateway (NodeJS/Express)
├── Microservices
│   ├── Landing Page Service
│   ├── AI Agent Service
│   ├── CRM Service
│   └── Payment Service
└── Database (MongoDB)
```

### Integrations
```
├── AI Models (GPT-4, Claude)
├── Communications (Twilio, SendGrid)
├── Payments (Plaid)
└── MLS APIs (User-provided)
```
