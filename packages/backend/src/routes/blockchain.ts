// Routes for blockchain/loan management endpoints
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthMiddleware } from '../middleware/auth.js';
import {
  createLoan,
  fundLoan,
  makePayment,
  markLoanDefaulted,
  disputeLoan,
  getLoanInfo,
  getRegistryStats,
  getLoanHistory,
  getBalance,
  getGasPrice,
  healthCheck,
} from '../controllers/blockchain.js';

export function createBlockchainRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const authMiddleware = new AuthMiddleware(prisma);

  // Health check endpoint (no auth required)
  router.get('/health', healthCheck);

  // Public endpoints (no auth required for reading data)
  router.get('/stats', getRegistryStats);
  router.get('/gas-price', getGasPrice);
  router.get('/loan/:loan_id', getLoanInfo);
  router.get('/loan/:loan_id/history', getLoanHistory);
  router.get('/balance/:address?', getBalance);

  // Protected endpoints (require authentication)
  router.use(authMiddleware.authenticate); // Apply authentication to all routes below

  // Loan creation and management
  router.post('/loan/create', createLoan);
  router.post('/loan/fund', fundLoan);
  router.post('/loan/payment', makePayment);
  router.post('/loan/default', markLoanDefaulted);
  router.post('/loan/dispute', disputeLoan);

  return router;
}