# Community P2P Lending Backend

## Authentication and User Management System

This backend service provides secure authentication and user management for the Community P2P Lending platform.

### Features Implemented

#### ✅ Task 3: Authentication and User Management Service

- **JWT-based Authentication**: Secure token-based authentication with access and refresh tokens
- **User Registration**: GDPR-compliant user registration with consent collection
- **User Profile Management**: Comprehensive profile management with privacy controls
- **Password Security**: bcrypt hashing with salt rounds and account lockout protection
- **Authorization Middleware**: Role-based access control and GDPR consent verification
- **Security Best Practices**: Rate limiting, security headers, input validation

### API Endpoints

#### Authentication (`/api/auth`)
- `POST /register` - Register new user with GDPR consent
- `POST /login` - User login with credentials
- `POST /refresh` - Refresh access token
- `GET /profile` - Get current user profile
- `POST /logout` - User logout
- `GET /health` - Service health check

#### User Management (`/api/users`)
- `GET /profile` - Get user profile (with privacy controls)
- `PUT /profile` - Update user profile
- `PUT /gdpr-consent` - Update GDPR consent settings
- `GET /export` - Export user data (GDPR compliance)
- `GET /audit-trail` - Get user audit trail
- `DELETE /account` - Delete user account (GDPR right to erasure)

### Security Features

1. **Password Security**
   - bcrypt hashing with 12 salt rounds
   - Account lockout after 5 failed attempts (15-minute lockout)
   - Strong password requirements

2. **JWT Security**
   - Separate access and refresh tokens
   - Short-lived access tokens (15 minutes)
   - Longer-lived refresh tokens (7 days)
   - Secure JWT claims with issuer/audience validation

3. **Rate Limiting**
   - Authentication endpoints: 5 requests per 15 minutes
   - General endpoints: 100 requests per 15 minutes
   - Sensitive operations: 10 requests per 15 minutes

4. **GDPR Compliance**
   - Explicit consent collection and management
   - Data portability (export functionality)
   - Right to erasure (account deletion)
   - Audit trail for all user actions
   - Privacy controls for profile visibility

5. **Security Headers**
   - Helmet.js for security headers
   - CORS configuration
   - Content Security Policy
   - XSS protection

### Database Schema

#### Core Tables
- `users` - Basic user information
- `user_auth` - Secure authentication data (passwords, 2FA)
- `user_profiles` - Extended profile information
- `gdpr_consents` - GDPR consent tracking
- `audit_logs` - Audit trail for compliance

### Environment Configuration

Required environment variables:
```bash
# Database
DATABASE_URL="postgresql://..."

# JWT Secrets (REQUIRED for production)
JWT_ACCESS_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"

# Server
PORT=3001
NODE_ENV="production"

# Frontend
FRONTEND_URL="https://your-frontend.com"
```

### Testing

The system includes comprehensive tests:
- Unit tests for authentication service
- Integration tests for API endpoints
- Security and validation testing

Run tests:
```bash
npm test
```

### Usage Examples

#### Register User
```javascript
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "gdprConsent": {
    "dataProcessingConsent": true,
    "aiAnalysisConsent": false,
    "marketingConsent": false,
    "dataRetentionPeriod": 365
  }
}
```

#### Login
```javascript
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Update Profile
```javascript
PUT /api/users/profile
Authorization: Bearer <access_token>
{
  "firstName": "Jane",
  "bio": "Updated bio",
  "occupation": "Software Developer"
}
```

### Next Steps

This authentication system is ready for integration with:
- AI trustworthiness scoring service (Task 4)
- Zero-knowledge proof system (Task 5)
- Blockchain integration (Task 6)
- Loan management system (Task 7)

The system provides a solid foundation with security, privacy, and compliance built-in from the start.