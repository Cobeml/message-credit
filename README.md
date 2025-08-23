# Community P2P Lending Platform - MVP

A privacy-preserving, AI-powered social credit scoring system that analyzes communication patterns to generate trustworthiness scores. This MVP focuses on secure message history upload and AI-based personality analysis for creditworthiness assessment.

## MVP Features

- **AI-Powered Social Credit Scoring**: Uses Claude AI to analyze communication patterns from iMessage, WhatsApp, and email to extract Big Five personality traits
- **Privacy-First Message Upload**: Encrypted/zero-knowledge message processing ensures user privacy and encourages adoption
- **Bias Detection & Mitigation**: Continuous monitoring and correction of algorithmic bias in scoring
- **GDPR Compliant**: Built-in privacy controls and data protection mechanisms
- **Multi-Platform Support**: Handles message exports from iMessage, WhatsApp, and email clients

## Project Structure

This is a monorepo containing the following packages:

- `packages/backend/` - Node.js API server with Express (MVP focus)
- `packages/frontend/` - React web application with TypeScript (separate development)
- `packages/zk-circuits/` - Halo2 zero-knowledge proof circuits in Rust (future enhancement)
- `packages/smart-contracts/` - Sui Move smart contracts (future enhancement)

## Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose (for PostgreSQL and Redis)
- Claude API key from Anthropic

## Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- Docker and Docker Compose
- **Claude API key from Anthropic** (required for AI analysis)

### 1. Clone and Install
```bash
git clone <repository-url>
cd p2p
npm install
```

### 2. Environment Setup
```bash
cd packages/backend
cp .env.example .env
```

**Edit `.env` with your Claude API key:**
```bash
# REQUIRED: Get your API key from https://console.anthropic.com/
CLAUDE_API_KEY="sk-ant-api03-your-actual-claude-api-key-here"

# Database (auto-configured with Docker)
DATABASE_URL="postgresql://postgres:password@localhost:5432/community_lending"
REDIS_URL="redis://localhost:6379"

# JWT secrets (generate secure random strings)
JWT_ACCESS_SECRET="your-super-secret-access-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"

# Server configuration
PORT=3001
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"
```

### 3. Start Services
```bash
# Start PostgreSQL and Redis
npm run docker:up

# Run database migrations
npm run migrate --workspace=@community-lending/backend

# Start backend server
npm run dev --workspace=@community-lending/backend
```

### 4. Test the AI Pipeline
Test the complete message analysis pipeline with realistic datasets:

```bash
# Test message dataset validation (validates our test data)
npm run test --workspace=@community-lending/backend -- message-datasets.test.ts --run

# Test AI trustworthiness scoring with simple examples
npm run test --workspace=@community-lending/backend -- ai-trustworthiness-simple.test.ts --run

# Test bias detection and mitigation
npm run test --workspace=@community-lending/backend -- bias-detection-simple.test.ts --run

# Test message processing and upload functionality
npm run test --workspace=@community-lending/backend -- message-processing.test.ts --run
```

**Expected Output:**
- **Big Five Personality Scores** (0-100 each): Conscientiousness, Neuroticism, Agreeableness, Openness, Extraversion
- **Behavioral Trustworthiness Score** (0-100): Based on promises kept, financial responsibility patterns
- **Overall Credit Score** (300-850): Traditional credit score format combining personality and behavior
- **Risk Assessment**: Detailed analysis of creditworthiness with specific examples from messages

### 5. Access the Application
- Backend API: http://localhost:3001
- API Health Check: http://localhost:3001/health
- Message Upload API: http://localhost:3001/api/message-upload/health

## Development

### Available Scripts

- `npm run dev --workspace=@community-lending/backend` - Start backend development server
- `npm run build --workspace=@community-lending/backend` - Build backend package
- `npm run test --workspace=@community-lending/backend` - Run backend tests
- `npm run lint` - Lint all packages
- `npm run format` - Format code with Prettier

### Backend Development

```bash
# Install dependencies
npm install

# Set up environment
cd packages/backend
cp .env.example .env
# Edit .env with your Claude API key and database credentials

# Start database services
npm run docker:up

# Run database migrations
npm run migrate --workspace=@community-lending/backend

# Start development server
npm run dev --workspace=@community-lending/backend

# Run tests
npm run test --workspace=@community-lending/backend
```

### Validating the AI Analysis Pipeline

**Important:** These tests require a valid Claude API key and will make real API calls. No fallback behavior is used to ensure the system is working correctly.

```bash
# Test realistic message datasets for MVP validation
npm run test --workspace=@community-lending/backend -- message-datasets.test.ts --run

# Test AI personality analysis with real Claude API calls
npm run test --workspace=@community-lending/backend -- ai-trustworthiness-simple.test.ts --run

# Test bias detection and mitigation
npm run test --workspace=@community-lending/backend -- bias-detection-simple.test.ts --run

# Test complete message upload and processing pipeline
npm run test --workspace=@community-lending/backend -- message-processing.test.ts --run

# Test message upload API endpoints
npm run test --workspace=@community-lending/backend -- message-upload-api.test.ts --run

# Run all tests
npm run test --workspace=@community-lending/backend
```

**Sample Test Output:**
```json
{
  "userId": "test-user-123",
  "analysis": {
    "bigFiveTraits": {
      "conscientiousness": 85,
      "neuroticism": 25,
      "agreeableness": 70,
      "openness": 60,
      "extraversion": 50
    },
    "behavioralTrustworthiness": 78,
    "overallCreditScore": 720,
    "riskAssessment": "Low Risk",
    "keyIndicators": [
      "Consistently follows through on commitments",
      "Shows financial responsibility in conversations",
      "Reliable communication patterns"
    ]
  }
}
```

## MVP Architecture

The current MVP focuses on the backend API for social credit scoring:

- **Backend API**: Node.js with Express, Prisma ORM, and Redis caching
- **AI Analysis**: Claude AI integration for personality trait extraction
- **Bias Detection**: Algorithmic fairness monitoring and correction
- **Database**: PostgreSQL for user data and analysis results
- **Cache**: Redis for session management and temporary data
- **Security**: JWT authentication, GDPR compliance, and data encryption

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/profile` - Get user profile

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/gdpr-consent` - Update GDPR consent
- `GET /api/users/export` - Export user data
- `DELETE /api/users/account` - Delete user account

### Message Upload and Analysis
- `POST /api/message-upload/upload` - Upload message history files (iMessage, WhatsApp, Email)
- `GET /api/message-upload/progress/:uploadId` - Check upload processing status
- `GET /api/message-upload/result/:uploadId` - Get processing results and metadata
- `GET /api/message-upload/list` - List user's message uploads
- `DELETE /api/message-upload/:uploadId` - Delete upload and associated data
- `GET /api/message-upload/formats` - Get supported message formats
- `GET /api/message-upload/health` - Service health check

## Current Implementation Status

✅ **Completed:**
- User authentication and management
- AI trustworthiness scoring engine (Claude integration)
- Bias detection and mitigation system
- GDPR compliance framework
- Database schema and migrations
- **Message file upload and processing system**
- **Multi-platform message format support (iMessage, WhatsApp, Email)**
- **Encrypted message processing with PII removal**
- **Realistic test message datasets for MVP validation**
- **Comprehensive test suite with reliable vs unreliable user datasets**

🚧 **In Progress:**
- Enhanced AI evaluation pipeline with comprehensive credit scoring
- End-to-end pipeline testing and validation

📋 **Planned:**
- Frontend application
- Blockchain integration
- Zero-knowledge proof circuits

## AI-Powered Credit Scoring

The MVP analyzes communication patterns to generate comprehensive creditworthiness assessments:

### Message Analysis Pipeline
1. **Secure Upload**: Encrypted file processing with PII removal
2. **Pattern Recognition**: AI analysis of communication behaviors  
3. **Personality Assessment**: Big Five trait extraction from message patterns
4. **Behavioral Analysis**: Promise-keeping, reliability, and financial responsibility indicators
5. **Credit Score Generation**: Traditional 300-850 score combining personality and behavior
6. **Risk Assessment**: Detailed creditworthiness evaluation with specific examples

### Supported Message Formats
- **iMessage**: Export from Messages app (JSON format)
- **WhatsApp**: Chat export files (TXT format)
- **Email**: Mailbox exports (MBOX, EML formats)
- **Generic**: Custom JSON/CSV formats

### Analysis Output Structure
```json
{
  "personalityTraits": {
    "conscientiousness": 85,    // Organization, reliability (40% weight)
    "neuroticism": 25,          // Emotional stability (25% weight, inverted)  
    "agreeableness": 70,        // Cooperation, trust (20% weight)
    "openness": 60,             // Adaptability (10% weight)
    "extraversion": 50          // Social confidence (5% weight)
  },
  "behavioralIndicators": {
    "promisesKept": 92,         // Commitment follow-through rate
    "financialResponsibility": 78, // Money-related reliability
    "communicationConsistency": 85  // Response patterns and reliability
  },
  "creditAssessment": {
    "overallScore": 720,        // Traditional credit score format (300-850)
    "riskLevel": "Low",         // Low, Medium, High
    "confidenceLevel": 88,      // Analysis confidence (0-100)
    "keyStrengths": ["Reliable communication", "Keeps commitments"],
    "riskFactors": ["Occasional financial stress indicators"]
  }
}
```

### Privacy & Security
- **Zero-Knowledge Processing**: Messages encrypted and processed without storing raw content
- **PII Removal**: Automatic detection and removal of personally identifiable information
- **Secure Upload**: Files encrypted in transit and at rest with automatic cleanup
- **GDPR Compliant**: Full user control over data processing and deletion
- **Bias Monitoring**: Continuous algorithmic fairness monitoring and correction

### Test Datasets for Validation

The system includes realistic test datasets for validating AI analysis:

**Reliable User Dataset (Alex)**
- 105+ messages spanning 8 months (Feb-Oct 2024)
- Patterns: On-time payments, kept promises, financial discipline
- Expected: High conscientiousness, low neuroticism, trust score 75-85

**Unreliable User Dataset (Jordan)**  
- 104+ messages spanning 8 months (Feb-Oct 2024)
- Patterns: Late payments, broken promises, financial stress
- Expected: Low conscientiousness, high neuroticism, trust score 25-40

**Available Formats:**
- JSON format: `reliable-user-messages.json`, `unreliable-user-messages.json`
- WhatsApp format: `reliable-user-whatsapp.txt`, `unreliable-user-whatsapp.txt`

**Test the datasets:**
```bash
npm run test --workspace=@community-lending/backend -- message-datasets.test.ts --run
```

### File Requirements
- Maximum file size: 50MB per upload
- Supported formats: JSON, TXT, CSV, MBOX, EML
- Minimum 50 messages required for reliable analysis
- Virus scanning and validation performed on all uploads

## Troubleshooting

### Claude API Issues
```bash
# Test your Claude API key
curl -H "Authorization: Bearer $CLAUDE_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.anthropic.com/v1/messages

# If you get authentication errors:
# 1. Check your API key at https://console.anthropic.com/
# 2. Ensure you have sufficient credits
# 3. Verify the key is correctly set in .env
```

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Reset database if needed
npm run docker:down
npm run docker:up
npm run migrate --workspace=@community-lending/backend
```

### Test Failures
```bash
# If AI tests fail, verify Claude API key is working
npm run test --workspace=@community-lending/backend -- --run ai-trustworthiness-simple

# If message processing tests fail, check file permissions
ls -la packages/backend/uploads/

# Clear test data
rm -rf packages/backend/test-uploads/
```

### Common Error Messages
- **"Claude API failed"**: Check your API key and credits
- **"Database connection failed"**: Ensure Docker containers are running
- **"File validation failed"**: Check file format and size limits
- **"Upload not found"**: Files expire after 24 hours automatically
- **"Test dataset validation failed"**: Ensure test datasets are properly formatted in `packages/backend/test-uploads/`

## Contributing

1. Follow the established code style (ESLint + Prettier)
2. Write tests for new functionality
3. Ensure all packages build successfully
4. Update documentation as needed
5. Test with real Claude API calls (no mocking for core functionality)

## License

[License information to be added]