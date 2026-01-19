# AI-Powered Real Estate Marketing & Lead Automation Platform

## Project Structure

This project follows a microservices architecture with a separated frontend.

### Frontend Layer
- **frontend/web-app**: Main React Web Application for realtors.
- **frontend/ios-app**: React Native iOS Application.
- **frontend/admin-dashboard**: Administration dashboard.

### Backend Layer
- **backend/api-gateway**: NodeJS/Express API Gateway handling requests and routing them to microservices.
- **backend/microservices**:
    - **landing-page-service**: Handles generation and serving of property landing pages.
    - **ai-agent-service**: Manages AI interactions (OpenAI/Anthropic) for content generation and communication.
    - **crm-service**: Manages leads, pipelines, and scoring.
    - **payment-service**: Handles subscriptions and billing via Plaid/Stripe.

### Integrations Library
- **integrations/ai-models**: Wrappers for GPT-4/Claude.
- **integrations/communications**: Clients for Twilio and SendGrid.
- **integrations/payments**: Clients for Plaid/Stripe.
- **integrations/mls-apis**: Connectors for various MLS providers.

## Getting Started
(Usage instructions to be added)
