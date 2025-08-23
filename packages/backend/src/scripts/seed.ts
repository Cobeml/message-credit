// Database seeding script for development environment

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()]
});

const prisma = new PrismaClient();

async function main() {
  try {
    logger.info('Starting database seeding...');

    // Clear existing data in development
    if (process.env.NODE_ENV === 'development') {
      logger.info('Clearing existing data...');
      
      // Delete in reverse dependency order
      await prisma.auditLog.deleteMany();
      await prisma.endorsement.deleteMany();
      await prisma.trustConnection.deleteMany();
      await prisma.biasFlag.deleteMany();
      await prisma.aiAnalysis.deleteMany();
      await prisma.zkProof.deleteMany();
      await prisma.gdprConsent.deleteMany();
      await prisma.payment.deleteMany();
      await prisma.repaymentSchedule.deleteMany();
      await prisma.loan.deleteMany();
      await prisma.communityMembership.deleteMany();
      await prisma.userProfile.deleteMany();
      await prisma.user.deleteMany();
      await prisma.community.deleteMany();
    }

    // Create sample communities
    logger.info('Creating sample communities...');
    
    const techCommunity = await prisma.community.create({
      data: {
        name: 'Tech Professionals Network',
        description: 'A community for technology professionals seeking peer-to-peer lending opportunities',
        memberCount: 0,
        maxLoanAmount: 50000,
        defaultInterestRate: 8.5,
        lendingRules: {
          maxLoanAmount: 50000,
          minLoanAmount: 1000,
          maxInterestRate: 15,
          minInterestRate: 5,
          maxLoanDuration: 365,
          minLoanDuration: 30,
          requiresEndorsement: true,
          minimumTrustScore: 70,
          allowedLoanPurposes: ['education', 'business', 'emergency', 'home_improvement']
        },
        governanceModel: {
          votingSystem: 'weighted',
          quorumRequirement: 0.3,
          proposalThreshold: 0.1,
          votingPeriod: 7,
          adminRights: ['manage_members', 'modify_rules', 'resolve_disputes'],
          moderatorRights: ['review_loans', 'moderate_discussions']
        }
      }
    });

    const localCommunity = await prisma.community.create({
      data: {
        name: 'Downtown Neighbors',
        description: 'Local community for residents of downtown area',
        memberCount: 0,
        maxLoanAmount: 10000,
        defaultInterestRate: 6.0,
        lendingRules: {
          maxLoanAmount: 10000,
          minLoanAmount: 500,
          maxInterestRate: 12,
          minInterestRate: 4,
          maxLoanDuration: 180,
          minLoanDuration: 30,
          requiresEndorsement: false,
          minimumTrustScore: 60,
          allowedLoanPurposes: ['emergency', 'education', 'small_business']
        },
        governanceModel: {
          votingSystem: 'simple',
          quorumRequirement: 0.5,
          proposalThreshold: 0.05,
          votingPeriod: 5,
          adminRights: ['manage_members', 'modify_rules'],
          moderatorRights: ['review_loans']
        }
      }
    });

    // Create sample users
    logger.info('Creating sample users...');
    
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const users = await Promise.all([
      // Tech community admin
      prisma.user.create({
        data: {
          email: 'alice.admin@techcommunity.com',
          firstName: 'Alice',
          lastName: 'Johnson',
          dateOfBirth: new Date('1985-03-15'),
          location: { country: 'US', region: 'CA', city: 'San Francisco' },
          languages: ['en', 'es'],
          digitalLiteracyLevel: 5,
          profile: {
            create: {
              phoneNumber: '+1-555-0101',
              occupation: 'Software Engineer',
              monthlyIncome: 8500,
              employmentStatus: 'employed',
              bankAccountVerified: true,
              identityVerified: true,
              bio: 'Experienced software engineer passionate about fintech and community building',
              preferredLoanTypes: ['business', 'education'],
              maxLoanAmount: 25000,
              riskTolerance: 'medium'
            }
          },
          gdprConsent: {
            create: {
              dataProcessingConsent: true,
              aiAnalysisConsent: true,
              marketingConsent: false,
              dataRetentionPeriod: 365
            }
          }
        }
      }),
      
      // Tech community member (potential borrower)
      prisma.user.create({
        data: {
          email: 'bob.developer@email.com',
          firstName: 'Bob',
          lastName: 'Smith',
          dateOfBirth: new Date('1990-07-22'),
          location: { country: 'US', region: 'CA', city: 'San Jose' },
          languages: ['en'],
          digitalLiteracyLevel: 4,
          profile: {
            create: {
              phoneNumber: '+1-555-0102',
              occupation: 'Junior Developer',
              monthlyIncome: 4500,
              employmentStatus: 'employed',
              bankAccountVerified: true,
              identityVerified: true,
              bio: 'Junior developer looking to advance career through education',
              preferredLoanTypes: ['education', 'emergency'],
              maxLoanAmount: 15000,
              riskTolerance: 'low'
            }
          },
          gdprConsent: {
            create: {
              dataProcessingConsent: true,
              aiAnalysisConsent: true,
              marketingConsent: true,
              dataRetentionPeriod: 365
            }
          }
        }
      }),
      
      // Local community member (potential lender)
      prisma.user.create({
        data: {
          email: 'carol.neighbor@email.com',
          firstName: 'Carol',
          lastName: 'Williams',
          dateOfBirth: new Date('1978-11-08'),
          location: { country: 'US', region: 'CA', city: 'San Francisco' },
          languages: ['en', 'fr'],
          digitalLiteracyLevel: 3,
          profile: {
            create: {
              phoneNumber: '+1-555-0103',
              occupation: 'Teacher',
              monthlyIncome: 5200,
              employmentStatus: 'employed',
              bankAccountVerified: true,
              identityVerified: true,
              bio: 'Local teacher interested in supporting community members',
              preferredLoanTypes: ['education', 'emergency'],
              maxLoanAmount: 8000,
              riskTolerance: 'low'
            }
          },
          gdprConsent: {
            create: {
              dataProcessingConsent: true,
              aiAnalysisConsent: false,
              marketingConsent: false,
              dataRetentionPeriod: 365
            }
          }
        }
      }),
      
      // Local community member (underbanked)
      prisma.user.create({
        data: {
          email: 'david.resident@email.com',
          firstName: 'David',
          lastName: 'Garcia',
          dateOfBirth: new Date('1995-02-14'),
          location: { country: 'US', region: 'CA', city: 'San Francisco' },
          languages: ['en', 'es'],
          digitalLiteracyLevel: 2,
          profile: {
            create: {
              phoneNumber: '+1-555-0104',
              occupation: 'Restaurant Worker',
              monthlyIncome: 2800,
              employmentStatus: 'employed',
              bankAccountVerified: false,
              identityVerified: true,
              bio: 'Hardworking restaurant employee seeking financial opportunities',
              preferredLoanTypes: ['emergency', 'small_business'],
              maxLoanAmount: 3000,
              riskTolerance: 'medium'
            }
          },
          gdprConsent: {
            create: {
              dataProcessingConsent: true,
              aiAnalysisConsent: true,
              marketingConsent: false,
              dataRetentionPeriod: 365
            }
          }
        }
      })
    ]);

    // Create community memberships
    logger.info('Creating community memberships...');
    
    await Promise.all([
      // Alice as admin of tech community
      prisma.communityMembership.create({
        data: {
          userId: users[0].id,
          communityId: techCommunity.id,
          role: 'admin',
          reputationScore: 95,
          endorsementCount: 5,
          successfulLoans: 3
        }
      }),
      
      // Bob as member of tech community
      prisma.communityMembership.create({
        data: {
          userId: users[1].id,
          communityId: techCommunity.id,
          role: 'member',
          reputationScore: 75,
          endorsementCount: 2,
          successfulLoans: 0
        }
      }),
      
      // Carol as member of local community
      prisma.communityMembership.create({
        data: {
          userId: users[2].id,
          communityId: localCommunity.id,
          role: 'moderator',
          reputationScore: 88,
          endorsementCount: 4,
          successfulLoans: 2
        }
      }),
      
      // David as member of local community
      prisma.communityMembership.create({
        data: {
          userId: users[3].id,
          communityId: localCommunity.id,
          role: 'member',
          reputationScore: 65,
          endorsementCount: 1,
          successfulLoans: 0
        }
      })
    ]);

    // Create sample AI analyses
    logger.info('Creating sample AI analyses...');
    
    await Promise.all([
      prisma.aiAnalysis.create({
        data: {
          userId: users[0].id,
          messageHistoryHash: 'hash_alice_messages_001',
          conscientiousness: 85,
          neuroticism: 25,
          agreeableness: 78,
          openness: 82,
          extraversion: 70,
          trustworthinessScore: 82,
          confidenceLevel: 88,
          modelVersion: 'claude-3-sonnet-20240229',
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
        }
      }),
      
      prisma.aiAnalysis.create({
        data: {
          userId: users[1].id,
          messageHistoryHash: 'hash_bob_messages_001',
          conscientiousness: 72,
          neuroticism: 45,
          agreeableness: 85,
          openness: 75,
          extraversion: 60,
          trustworthinessScore: 74,
          confidenceLevel: 82,
          modelVersion: 'claude-3-sonnet-20240229',
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        }
      })
    ]);

    // Create sample trust connections
    logger.info('Creating sample trust connections...');
    
    await Promise.all([
      prisma.trustConnection.create({
        data: {
          fromUserId: users[0].id,
          toUserId: users[1].id,
          trustLevel: 85,
          connectionType: 'colleague',
          lastInteraction: new Date()
        }
      }),
      
      prisma.trustConnection.create({
        data: {
          fromUserId: users[2].id,
          toUserId: users[3].id,
          trustLevel: 70,
          connectionType: 'community',
          lastInteraction: new Date()
        }
      })
    ]);

    // Create sample endorsements
    logger.info('Creating sample endorsements...');
    
    await Promise.all([
      prisma.endorsement.create({
        data: {
          fromUserId: users[0].id,
          toUserId: users[1].id,
          endorsementType: 'professional',
          message: 'Bob is a dedicated developer with strong work ethic',
          rating: 4,
          isPublic: true
        }
      }),
      
      prisma.endorsement.create({
        data: {
          fromUserId: users[2].id,
          toUserId: users[3].id,
          endorsementType: 'character',
          message: 'David is a reliable and honest community member',
          rating: 5,
          isPublic: true
        }
      })
    ]);

    // Create sample loan
    logger.info('Creating sample loan...');
    
    const sampleLoan = await prisma.loan.create({
      data: {
        borrowerId: users[1].id,
        lenderId: users[0].id,
        communityId: techCommunity.id,
        amount: 5000,
        interestRate: 8.5,
        duration: 180,
        purpose: 'Professional certification course',
        status: 'active',
        applicationDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        fundedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      }
    });

    // Create repayment schedule for the loan
    logger.info('Creating repayment schedule...');
    
    const monthlyPayment = 5000 * (8.5 / 100 / 12) / (1 - Math.pow(1 + (8.5 / 100 / 12), -6)); // 6 months
    const startDate = new Date();
    
    for (let i = 1; i <= 6; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      
      await prisma.repaymentSchedule.create({
        data: {
          loanId: sampleLoan.id,
          installmentNumber: i,
          dueDate: dueDate,
          principalAmount: monthlyPayment * 0.8, // Simplified calculation
          interestAmount: monthlyPayment * 0.2,
          totalAmount: monthlyPayment
        }
      });
    }

    // Create audit log entries
    logger.info('Creating audit log entries...');
    
    await prisma.auditLog.create({
      data: {
        userId: users[0].id,
        action: 'USER_REGISTRATION',
        entityType: 'user',
        entityId: users[0].id,
        newValues: { email: users[0].email, firstName: users[0].firstName },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    });

    logger.info('Database seeding completed successfully!');
    
    // Log summary
    const userCount = await prisma.user.count();
    const communityCount = await prisma.community.count();
    const loanCount = await prisma.loan.count();
    
    logger.info('Seeding summary:', {
      users: userCount,
      communities: communityCount,
      loans: loanCount
    });

  } catch (error) {
    logger.error('Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding script
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });