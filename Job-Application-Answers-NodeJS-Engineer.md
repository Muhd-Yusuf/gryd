# Remote - Node.js Engineer | Application Answers

---

## 1. Why are you currently on the job market and what is your target salary?

I'm transitioning from a founder/generalist role into a focused full-time engineering career. Over the past five years, I built and led SYDA Group — a technology company delivering healthcare solutions for government programs in Nigeria. That journey gave me deep technical and leadership experience, but I've reached a point where I want to go deeper as an engineer rather than wider as a CEO. I'm looking for a team where I can focus entirely on building great software, contribute to meaningful technical challenges, and grow alongside experienced engineers in a structured environment.

For salary, I'm flexible and open to discussing a range that reflects the role's scope, the team's compensation structure, and the value I can deliver. That said, for a remote Node.js engineering role, I'm targeting the range of $50,000–$75,000 USD annually, and I'm open to adjusting based on the full compensation package, equity, and growth trajectory. I'm more motivated by the right technical environment and long-term opportunity than by maximizing short-term compensation.

> **Note to you (Sada):** Adjust the salary range based on the specific company. If it's a US-based startup paying US rates, $60K–$90K is reasonable for mid-level remote. If it's a global company with geo-adjusted pay, $40K–$60K may be more realistic. Research the company on Glassdoor/Levels.fyi first. If unsure, just say: "I'm open to discussing a range that aligns with your compensation band for this role."

---

## 2. Tell me about your experience working with early stage startups and/or companies/personal projects you've started.

I founded SYDA Group in 2019 while still in university — starting with nothing but a laptop and a problem to solve. The first product was a digital health record system I built for a local government health facility that was still running on paper registers. I did everything: requirements gathering with healthcare workers, system design, full-stack development (React + Node.js + PostgreSQL), deployment on AWS, and user training.

From that single project, I grew SYDA into a multi-subsidiary technology company serving multiple government health programs across Northern Nigeria. I experienced every stage of early-company building firsthand:

- **Zero-to-one product development** — identifying problems, building MVPs, iterating based on real user feedback from healthcare workers in the field
- **Wearing every hat** — I was the engineer, the project manager, the sales lead, and the support team simultaneously
- **Building with constraints** — limited budgets, unreliable internet, users with low technical literacy. This forced me to build resilient, offline-first systems and prioritize simplicity
- **Hiring and mentoring** — grew the team from just me to a cross-functional team of 8, establishing code review practices and development workflows from scratch
- **Revenue and partnerships** — secured government contracts and NGO partnerships to sustain the company without external funding

This experience means I understand the pace, ambiguity, and resourcefulness that early-stage work demands. I don't wait for perfect specs — I ship, measure, and iterate.

---

## 3. Please describe the core tech stack you have worked with over the last 3-5 years. We are looking for expert level Node.js experience.

**Node.js has been the backbone of every backend system I've built over the past 4+ years.** My core production stack:

**Node.js / Express (Primary backend — expert level):**
- Built and maintained multiple production REST APIs serving web and mobile clients simultaneously
- Designed microservices architectures with Express, handling authentication (JWT, session management), role-based access control, and middleware chains
- Implemented real-time data synchronization between offline-first React Native mobile apps and Node.js backends using WebSockets and queue-based reconciliation
- Built background job processing for health data aggregation and report generation
- Integrated third-party services: Twilio (SMS/voice), Paystack and Flutterwave (payments), and AI/LLM APIs (OpenAI, Claude) via Node.js SDKs
- Wrote automated tests and set up CI/CD pipelines (GitHub Actions) for Node.js services deployed on AWS (EC2, Lambda)
- Experienced with Node.js performance patterns: connection pooling, caching strategies, error handling middleware, graceful shutdown, and structured logging

**Full production stack:**
- **Frontend:** React, Next.js, React Native (Expo)
- **Backend:** Node.js, Express, Python/FastAPI (secondary)
- **Databases:** PostgreSQL (primary relational), MongoDB (document store), Firebase/Firestore (real-time)
- **Cloud/Infra:** AWS (EC2, Lambda, S3, RDS), Vercel, Docker
- **DevOps:** GitHub Actions, CI/CD pipelines, automated testing
- **AI tooling:** LLM integration via Node.js (OpenAI SDK, Anthropic SDK), AI agents, augmented coding (Claude Code, GitHub Copilot)

I'm not someone who has only used Node.js in tutorials — I've built, deployed, monitored, and maintained Node.js systems that real users depend on daily in production.

---

## 4. What is your most impressive career accomplishment?

Building a digital health record system that replaced paper-based workflows across multiple government health facilities in Northern Nigeria — and doing it from scratch as a university student with no funding, no team, and no playbook.

The problem was real: healthcare workers were recording patient data in paper registers. Reports took weeks to compile manually. Data was lost, duplicated, or simply never analyzed. Treatment tracking across visits was nearly impossible.

I designed and built the full system:
- **React web dashboard** for facility administrators to view real-time program data and generate reports
- **React Native mobile app** with offline-first architecture so healthcare workers could capture patient data in areas with no internet connectivity, with automatic sync when connection was restored
- **Node.js + PostgreSQL backend** on AWS handling data ingestion, user authentication, and reporting APIs
- **Twilio integration** for SMS-based appointment reminders and program notifications

The technical challenge was significant — building reliable offline-first sync with conflict resolution is a hard problem — but the impact is what I'm most proud of. Healthcare workers who previously spent hours on paperwork could now complete data entry in minutes. Program managers could see real-time dashboards instead of waiting weeks for manual reports. The system directly improved how health programs were monitored and delivered in underserved communities.

This project also proved I could take a product from idea to production entirely on my own, then build a company around it. That combination of technical depth and entrepreneurial execution is what I bring to every team I join.

---

## 5. Please describe your experience with any of the following: building integrations, ETL or data synchronization systems.

This is one of my strongest areas — data synchronization was a core technical challenge across my healthcare projects.

**Data Synchronization (Offline-First Sync System):**
The most complex system I built was the offline-first data sync layer for our healthcare mobile app. Healthcare workers in rural Northern Nigeria often operate in areas with no internet. The React Native app needed to:
- Capture patient records fully offline with local storage (SQLite/AsyncStorage)
- Queue all changes with timestamps and conflict metadata
- Automatically detect connectivity and sync queued data to the Node.js backend
- Handle **conflict resolution** when the same record was modified on multiple devices or on the web dashboard simultaneously — I implemented a last-write-wins strategy with manual review flags for critical conflicts
- Ensure **data integrity** with transaction-based sync batches so partial syncs wouldn't corrupt the dataset

This is essentially a custom ETL pipeline: **Extract** data from the mobile device's local store, **Transform** it (validate, deduplicate, resolve conflicts), and **Load** it into the PostgreSQL production database via the Node.js API.

**Third-Party Integrations:**
- **Twilio:** Built SMS notification pipelines in Node.js — appointment reminders, program alerts, and two-way messaging for community health engagement. Handled webhook callbacks for delivery receipts and inbound messages.
- **Paystack & Flutterwave:** Payment gateway integration for program fee collection. Built webhook listeners in Express to handle payment confirmations, failures, and reconciliation with internal transaction records.
- **AI/LLM APIs:** Integrated OpenAI and Claude APIs into Node.js backends for intelligent features — health data analysis, automated report generation, and smart search across medical records.

**Data Pipeline for Health Program Reporting:**
Built a Node.js-based data aggregation pipeline that pulled raw patient records from PostgreSQL, applied transformation logic (grouping by facility, time period, and health indicators), and generated structured reports for government program managers. Scheduled via cron jobs on AWS, with error handling and retry logic for failed aggregation runs.

I'm comfortable building systems where data moves between multiple sources, needs transformation, and must arrive reliably — whether that's device-to-server sync, third-party webhook processing, or scheduled ETL jobs.
