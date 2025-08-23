// API integration tests

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../app.js';
import { Express } from 'express';

describe('API Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let authToken: string;
  let refreshToken: string;
  let userId: string;

  beforeAll(async () => {
    // Use test database
    const testDatabaseUrl = process.env.DATABASE_URL_TEST || 
                           process.env.DATABASE_URL || 
                           'file:./test.db';
    
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: testDatabaseUrl
        }
      }
    });
    
    await prisma.$connect();
    app = createApp(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany();
    await prisma.gDPRConsent.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.userAuth.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Health Check Endpoints', () => {
    it('should return health status for main endpoint', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
    });

    it('should return API documentation', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Community P2P Lending API');
      expect(response.body.data.endpoints).toBeDefined();
    });

    it('should return auth service health', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.service).toBe('authentication');
    });
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should register user successfully with valid data', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          gdprConsent: {
            dataProcessingConsent: true,
            aiAnalysisConsent: false,
            marketingConsent: false,
            dataRetentionPeriod: 365
          }
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.user.email).toBe(userData.email);
        expect(response.body.data.tokens).toBeDefined();
        expect(response.body.data.tokens.accessToken).toBeDefined();
        expect(response.body.data.tokens.refreshToken).toBeDefined();

        // Store for later tests
        authToken = response.body.data.tokens.accessToken;
        refreshToken = response.body.data.tokens.refreshToken;
        userId = response.body.data.user.id;
      });

      it('should reject registration with invalid email', async () => {
        const userData = {
          email: 'invalid-email',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          gdprConsent: {
            dataProcessingConsent: true,
            aiAnalysisConsent: false,
            marketingConsent: false
          }
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_INPUT');
      });

      it('should reject registration with weak password', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'weak',
          firstName: 'Test',
          lastName: 'User',
          gdprConsent: {
            dataProcessingConsent: true,
            aiAnalysisConsent: false,
            marketingConsent: false
          }
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_INPUT');
      });

      it('should reject registration without GDPR consent', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          gdprConsent: {
            dataProcessingConsent: false,
            aiAnalysisConsent: false,
            marketingConsent: false
          }
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/auth/login', () => {
      beforeEach(async () => {
        // Register a test user
        const userData = {
          email: 'test@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          gdprConsent: {
            dataProcessingConsent: true,
            aiAnalysisConsent: false,
            marketingConsent: false
          }
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        userId = response.body.data.user.id;
      });

      it('should login successfully with valid credentials', async () => {
        const credentials = {
          email: 'test@example.com',
          password: 'TestPassword123!'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.tokens).toBeDefined();

        authToken = response.body.data.tokens.accessToken;
        refreshToken = response.body.data.tokens.refreshToken;
      });

      it('should reject login with invalid credentials', async () => {
        const credentials = {
          email: 'test@example.com',
          password: 'WrongPassword123!'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
    });

    describe('POST /api/auth/refresh', () => {
      beforeEach(async () => {
        // Register and login to get tokens
        const userData = {
          email: 'test@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          gdprConsent: {
            dataProcessingConsent: true,
            aiAnalysisConsent: false,
            marketingConsent: false
          }
        };

        const registerResponse = await request(app)
          .post('/api/auth/register')
          .send(userData);

        refreshToken = registerResponse.body.data.tokens.refreshToken;
      });

      it('should refresh tokens successfully', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.tokens).toBeDefined();
        expect(response.body.data.tokens.accessToken).toBeDefined();
        expect(response.body.data.tokens.refreshToken).toBeDefined();
      });

      it('should reject invalid refresh token', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: 'invalid-token' })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
    });

    describe('GET /api/auth/profile', () => {
      beforeEach(async () => {
        // Register and login to get tokens
        const userData = {
          email: 'test@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          gdprConsent: {
            dataProcessingConsent: true,
            aiAnalysisConsent: false,
            marketingConsent: false
          }
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        authToken = response.body.data.tokens.accessToken;
      });

      it('should return user profile with valid token', async () => {
        const response = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.user.email).toBe('test@example.com');
      });

      it('should reject request without token', async () => {
        const response = await request(app)
          .get('/api/auth/profile')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
    });
  });

  describe('User Management Endpoints', () => {
    beforeEach(async () => {
      // Register and login to get tokens
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        gdprConsent: {
          dataProcessingConsent: true,
          aiAnalysisConsent: true,
          marketingConsent: false
        }
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = response.body.data.tokens.accessToken;
      userId = response.body.data.user.id;
    });

    describe('GET /api/users/profile', () => {
      it('should return user profile', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.user.email).toBe('test@example.com');
        expect(response.body.data.user.gdprConsent).toBeDefined();
      });
    });

    describe('PUT /api/users/profile', () => {
      it('should update user profile successfully', async () => {
        const updateData = {
          firstName: 'Updated',
          lastName: 'Name',
          bio: 'This is my updated bio',
          occupation: 'Software Developer'
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.firstName).toBe('Updated');
        expect(response.body.data.user.lastName).toBe('Name');
        expect(response.body.data.user.profile.bio).toBe('This is my updated bio');
      });

      it('should reject invalid update data', async () => {
        const updateData = {
          firstName: '', // Invalid: empty string
          digitalLiteracyLevel: 10 // Invalid: out of range
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_INPUT');
      });
    });

    describe('PUT /api/users/gdpr-consent', () => {
      it('should update GDPR consent successfully', async () => {
        const consentData = {
          aiAnalysisConsent: false,
          marketingConsent: true,
          dataRetentionPeriod: 730
        };

        const response = await request(app)
          .put('/api/users/gdpr-consent')
          .set('Authorization', `Bearer ${authToken}`)
          .send(consentData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.gdprConsent.aiAnalysisConsent).toBe(false);
        expect(response.body.data.gdprConsent.marketingConsent).toBe(true);
        expect(response.body.data.gdprConsent.dataRetentionPeriod).toBe(730);
      });
    });

    describe('GET /api/users/export', () => {
      it('should export user data successfully', async () => {
        const response = await request(app)
          .get('/api/users/export')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.auditTrail).toBeDefined();
        expect(response.body.data.exportDate).toBeDefined();
      });
    });

    describe('GET /api/users/audit-trail', () => {
      it('should return audit trail', async () => {
        // First make some changes to create audit entries
        await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ firstName: 'Updated' });

        const response = await request(app)
          .get('/api/users/audit-trail')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.auditTrail).toBeDefined();
        expect(Array.isArray(response.body.data.auditTrail)).toBe(true);
      });
    });

    describe('DELETE /api/users/account', () => {
      it('should delete account successfully', async () => {
        const response = await request(app)
          .delete('/api/users/account')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toBe('Account deleted successfully');

        // Verify user is deactivated
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });
        expect(user?.isActive).toBe(false);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on auth endpoints', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
        firstName: 'Test',
        lastName: 'User',
        gdprConsent: {
          dataProcessingConsent: true,
          aiAnalysisConsent: false,
          marketingConsent: false
        }
      };

      // First register a user
      await request(app)
        .post('/api/auth/register')
        .send({
          ...userData,
          password: 'TestPassword123!'
        });

      // Make multiple failed login attempts
      const promises = [];
      for (let i = 0; i < 6; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: userData.email,
              password: userData.password
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited
      const rateLimited = responses.some(response => response.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});