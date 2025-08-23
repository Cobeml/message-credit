// Database migration utilities and helpers

import { PrismaClient } from '@prisma/client';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

export class MigrationManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Run all pending migrations
   */
  public async runMigrations(): Promise<void> {
    try {
      logger.info('Starting database migrations...');
      
      // Prisma handles migrations automatically with prisma migrate deploy
      // This method can be used for custom migration logic if needed
      
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', { error });
      throw error;
    }
  }

  /**
   * Create initial indexes for performance optimization
   */
  public async createIndexes(): Promise<void> {
    try {
      logger.info('Creating database indexes...');

      // Create custom indexes that aren't handled by Prisma schema
      const indexQueries = [
        // User search indexes
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active 
         ON users(email) WHERE is_active = true;`,
        
        // Loan search and filtering indexes
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_status_community 
         ON loans(status, community_id);`,
        
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_borrower_status 
         ON loans(borrower_id, status);`,
        
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_lender_status 
         ON loans(lender_id, status) WHERE lender_id IS NOT NULL;`,
        
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_amount_range 
         ON loans(amount) WHERE status IN ('pending', 'funded');`,
        
        // AI analysis indexes
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_analyses_user_active 
         ON ai_analyses(user_id) WHERE is_active = true;`,
        
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_analyses_expires 
         ON ai_analyses(expires_at) WHERE is_active = true;`,
        
        // ZK proof indexes
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zk_proofs_user_type_active 
         ON zk_proofs(user_id, proof_type) WHERE is_active = true;`,
        
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zk_proofs_expires 
         ON zk_proofs(expires_at) WHERE is_active = true;`,
        
        // Community membership indexes
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_community_memberships_community_active 
         ON community_memberships(community_id) WHERE is_active = true;`,
        
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_community_memberships_user_active 
         ON community_memberships(user_id) WHERE is_active = true;`,
        
        // Trust network indexes
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trust_connections_from_user 
         ON trust_connections(from_user_id) WHERE is_active = true;`,
        
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trust_connections_to_user 
         ON trust_connections(to_user_id) WHERE is_active = true;`,
        
        // Audit log indexes
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_timestamp 
         ON audit_logs(user_id, timestamp) WHERE user_id IS NOT NULL;`,
        
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity 
         ON audit_logs(entity_type, entity_id);`,
        
        // Repayment schedule indexes
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_repayment_schedules_due_date 
         ON repayment_schedules(due_date) WHERE is_paid = false;`,
        
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_repayment_schedules_loan_unpaid 
         ON repayment_schedules(loan_id) WHERE is_paid = false;`
      ];

      for (const query of indexQueries) {
        try {
          await this.prisma.$executeRawUnsafe(query);
          logger.info('Index created successfully', { query: query.split('\n')[0] });
        } catch (error) {
          // Log but don't fail if index already exists
          logger.warn('Index creation skipped (may already exist)', { 
            query: query.split('\n')[0], 
            error: (error as Error).message 
          });
        }
      }

      logger.info('Database indexes creation completed');
    } catch (error) {
      logger.error('Index creation failed', { error });
      throw error;
    }
  }

  /**
   * Create database functions and triggers for automated tasks
   */
  public async createFunctions(): Promise<void> {
    try {
      logger.info('Creating database functions and triggers...');

      // Function to update community member count
      const updateMemberCountFunction = `
        CREATE OR REPLACE FUNCTION update_community_member_count()
        RETURNS TRIGGER AS $$
        BEGIN
          IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
            UPDATE communities 
            SET member_count = member_count + 1 
            WHERE id = NEW.community_id;
          ELSIF TG_OP = 'UPDATE' THEN
            IF OLD.is_active = false AND NEW.is_active = true THEN
              UPDATE communities 
              SET member_count = member_count + 1 
              WHERE id = NEW.community_id;
            ELSIF OLD.is_active = true AND NEW.is_active = false THEN
              UPDATE communities 
              SET member_count = member_count - 1 
              WHERE id = NEW.community_id;
            END IF;
          ELSIF TG_OP = 'DELETE' AND OLD.is_active = true THEN
            UPDATE communities 
            SET member_count = member_count - 1 
            WHERE id = OLD.community_id;
          END IF;
          
          IF TG_OP = 'DELETE' THEN
            RETURN OLD;
          ELSE
            RETURN NEW;
          END IF;
        END;
        $$ LANGUAGE plpgsql;
      `;

      await this.prisma.$executeRawUnsafe(updateMemberCountFunction);

      // Trigger for community member count
      const memberCountTrigger = `
        DROP TRIGGER IF EXISTS trigger_update_community_member_count ON community_memberships;
        CREATE TRIGGER trigger_update_community_member_count
          AFTER INSERT OR UPDATE OR DELETE ON community_memberships
          FOR EACH ROW EXECUTE FUNCTION update_community_member_count();
      `;

      await this.prisma.$executeRawUnsafe(memberCountTrigger);

      // Function to clean up expired records
      const cleanupExpiredFunction = `
        CREATE OR REPLACE FUNCTION cleanup_expired_records()
        RETURNS void AS $$
        BEGIN
          -- Deactivate expired AI analyses
          UPDATE ai_analyses 
          SET is_active = false 
          WHERE expires_at < NOW() AND is_active = true;
          
          -- Deactivate expired ZK proofs
          UPDATE zk_proofs 
          SET is_active = false 
          WHERE expires_at < NOW() AND is_active = true;
          
          -- Log cleanup activity
          INSERT INTO audit_logs (action, entity_type, entity_id, new_values, timestamp)
          VALUES ('CLEANUP_EXPIRED', 'system', 'cleanup_job', 
                  json_build_object('timestamp', NOW()), NOW());
        END;
        $$ LANGUAGE plpgsql;
      `;

      await this.prisma.$executeRawUnsafe(cleanupExpiredFunction);

      logger.info('Database functions and triggers created successfully');
    } catch (error) {
      logger.error('Function creation failed', { error });
      throw error;
    }
  }

  /**
   * Validate database schema and constraints
   */
  public async validateSchema(): Promise<boolean> {
    try {
      logger.info('Validating database schema...');

      // Check if all required tables exist
      const requiredTables = [
        'users', 'user_profiles', 'communities', 'community_memberships',
        'loans', 'repayment_schedules', 'payments', 'ai_analyses',
        'bias_flags', 'zk_proofs', 'gdpr_consents', 'trust_connections',
        'endorsements', 'audit_logs'
      ];

      for (const table of requiredTables) {
        const result = await this.prisma.$queryRawUnsafe(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${table}'
          );
        `) as [{ exists: boolean }];

        if (!result[0].exists) {
          throw new Error(`Required table '${table}' does not exist`);
        }
      }

      // Validate foreign key constraints
      const constraintCheck = await this.prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count
        FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_schema = 'public';
      `) as [{ count: bigint }];

      if (Number(constraintCheck[0].count) < 10) {
        logger.warn('Fewer foreign key constraints than expected');
      }

      logger.info('Database schema validation completed successfully');
      return true;
    } catch (error) {
      logger.error('Schema validation failed', { error });
      return false;
    }
  }

  /**
   * Get database statistics and health metrics
   */
  public async getDatabaseStats(): Promise<any> {
    try {
      const stats = await this.prisma.$queryRawUnsafe(`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        ORDER BY tablename, attname;
      `);

      const tableStats = await this.prisma.$queryRawUnsafe(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename;
      `);

      return {
        columnStats: stats,
        tableStats: tableStats,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to get database stats', { error });
      throw error;
    }
  }
}