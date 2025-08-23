# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Community P2P Lending Platform** - a privacy-preserving, AI-powered social credit scoring system that analyzes communication patterns to generate trustworthiness scores. The MVP focuses on secure message history upload and AI-based personality analysis for creditworthiness assessment.

## Architecture

**Monorepo Structure:**
- `packages/backend/` - Node.js Express API server (primary development focus)
- `packages/frontend/` - React web application with TypeScript
- `packages/smart-contracts/` - Sui Move smart contracts (future enhancement) 
- `packages/zk-circuits/` - Halo2 zero-knowledge proof circuits in Rust (future enhancement)

**Backend Stack:**
- **Runtime:** Node.js 18+ with ES Modules
- **Framework:** Express.js with TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Cache:** Redis for sessions and temporary data
- **AI Integration:** Claude API (Anthropic) for personality trait extraction
- **Authentication:** JWT with refresh tokens
- **Testing:** Vitest with Supertest

## Common Development Commands

### Environment Setup
```bash
# Install all dependencies
npm install

# Start PostgreSQL and Redis services
npm run docker:up

# Stop services
npm run docker:down
```

### Backend Development
```bash
# Start backend development server
npm run dev --workspace=@community-lending/backend

# Build backend
npm run build --workspace=@community-lending/backend

# Run all tests
npm run test --workspace=@community-lending/backend

# Run specific test files
npm run test --workspace=@community-lending/backend -- bias-detection
npm run test --workspace=@community-lending/backend -- ai-trustworthiness

# Watch mode for tests
npm run test:watch --workspace=@community-lending/backend

# Database operations
npm run db:migrate --workspace=@community-lending/backend
npm run db:generate --workspace=@community-lending/backend
npm run db:seed --workspace=@community-lending/backend
```

### Code Quality
```bash
# Lint all packages
npm run lint

# Format code with Prettier
npm run format

# Lint backend specifically
npm run lint --workspace=@community-lending/backend
```

## Key Architecture Concepts

### AI-Powered Social Credit Scoring
- Uses Claude AI to analyze communication patterns from iMessage, WhatsApp, and email
- Extracts Big Five personality traits: conscientiousness, neuroticism, agreeableness, openness, extraversion
- Generates trustworthiness scores with confidence levels
- Implements bias detection and mitigation systems

### Privacy-First Design
- Zero-knowledge message processing ensures user privacy
- Encrypted/hashed message content storage
- Comprehensive GDPR compliance with consent management
- Automatic PII removal from analyzed content
- User-controlled data retention and deletion

### Database Schema Design
The Prisma schema (`packages/backend/prisma/schema.prisma`) implements:
- **User Management:** Separate authentication (`UserAuth`) and profile (`UserProfile`) models
- **Community System:** Community memberships with roles and reputation scoring  
- **Loan Management:** Full loan lifecycle with repayment schedules and payment tracking
- **AI Analysis:** Personality trait storage with bias flag tracking
- **Privacy Controls:** GDPR consent management and audit logging
- **Trust Network:** Social connections and community endorsements
- **ZK Proofs:** Future zero-knowledge proof storage

### Security Implementation
- JWT-based authentication with refresh token rotation
- bcrypt password hashing (12 rounds)
- Rate limiting (100 requests/15min, 5 auth attempts/15min)
- Security headers with Helmet.js
- Account lockout after failed login attempts
- Request ID tracking for audit trails

### Testing Strategy
- Uses Vitest with test environment variables in `vitest.config.ts`
- Integration tests for API endpoints with Supertest
- Unit tests for AI analysis and bias detection systems
- Mock data generation for personality scoring tests
- Test database with SQLite (`file:./test.db`)

## Environment Configuration

Copy `packages/backend/.env.example` to `packages/backend/.env` and configure:

**Required for Development:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string  
- `CLAUDE_API_KEY` - Anthropic Claude API key
- `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET` - JWT signing secrets

**Development Services Access:**
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/api/docs
- Database Admin (Adminer): http://localhost:8080
- Redis Admin: http://localhost:8081

## AI Integration Details

The system integrates with Claude API for:
1. **Message Analysis:** Processing uploaded message histories
2. **Personality Extraction:** Big Five personality trait scoring
3. **Trustworthiness Assessment:** Converting traits to creditworthiness scores
4. **Bias Detection:** Monitoring algorithmic fairness

Key services:
- `services/ai-trustworthiness.ts` - Core AI analysis engine
- `services/bias-detection.ts` - Bias monitoring and mitigation
- `services/message-processing.ts` - Message upload and processing

## Current Implementation Status

**✅ Completed MVP Features:**
- User authentication and management
- AI trustworthiness scoring engine  
- Bias detection and mitigation system
- GDPR compliance framework
- Database schema and migrations

**🚧 In Development:**
- Message file upload and processing
- Zero-knowledge message encryption
- Multi-platform message format support

**📋 Future Enhancements:**
- Frontend React application
- Sui blockchain integration
- Halo2 zero-knowledge proof circuits

## Development Guidelines

- Follow existing TypeScript/ESM patterns
- All database operations use Prisma ORM
- API responses follow standardized format with `success`, `data`, `error`, `timestamp`, `requestId`
- Environment variables are validated and typed in `types/index.ts`
- Comprehensive error handling with custom `APIError` class
- Request logging with Winston
- Security-first approach for all data handling