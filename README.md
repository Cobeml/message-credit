# Community P2P Lending Platform

A privacy-preserving, AI-powered peer-to-peer lending service designed for small communities. The platform leverages zero-knowledge proofs, blockchain technology, and ethical AI to create a trustworthy and inclusive lending environment.

## Features

- **AI-Powered Trustworthiness Scoring**: Uses Claude NLP to analyze communication patterns and extract Big Five personality traits for creditworthiness assessment
- **Zero-Knowledge Privacy**: Halo2-based ZK proofs ensure sensitive data never leaves user control
- **Blockchain Security**: Sui blockchain integration for immutable loan records and secure transactions
- **Community-Centric**: Designed specifically for small community dynamics and social trust networks
- **GDPR Compliant**: Built-in privacy controls and data protection mechanisms
- **Bias-Free AI**: Continuous monitoring and mitigation of algorithmic bias

## Project Structure

This is a monorepo containing the following packages:

- `packages/frontend/` - React web application with TypeScript
- `packages/backend/` - Node.js API server with Express
- `packages/zk-circuits/` - Halo2 zero-knowledge proof circuits in Rust
- `packages/smart-contracts/` - Sui Move smart contracts

## Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- Rust (for ZK circuits)
- Sui CLI (for smart contracts)

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd community-p2p-lending
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development services:**
   ```bash
   # Start PostgreSQL and Redis
   npm run docker:up
   
   # Start development servers
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Database Admin: http://localhost:8080
   - Redis Admin: http://localhost:8081

## Development

### Available Scripts

- `npm run dev` - Start all development servers
- `npm run build` - Build all packages
- `npm run test` - Run tests for all packages
- `npm run lint` - Lint all packages
- `npm run format` - Format code with Prettier

### Package-Specific Scripts

Each package has its own scripts. Run them with:
```bash
npm run <script> --workspace=@community-lending/<package>
```

For example:
```bash
npm run test --workspace=@community-lending/backend
npm run build --workspace=@community-lending/zk-circuits
```

## Architecture

The platform follows a microservices architecture with the following key components:

- **Frontend**: React SPA with TypeScript, Tailwind CSS, and Vite
- **Backend**: Node.js API with Express, Prisma ORM, and Redis caching
- **ZK Circuits**: Rust-based Halo2 circuits with Node.js FFI bindings
- **Smart Contracts**: Sui Move contracts for loan management
- **Database**: PostgreSQL for persistent data storage
- **Cache**: Redis for session management and caching

## Contributing

1. Follow the established code style (ESLint + Prettier)
2. Write tests for new functionality
3. Ensure all packages build successfully
4. Update documentation as needed

## License

[License information to be added]