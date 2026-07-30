/**
 * Recurra — Auth Routes
 * POST /api/v1/auth/connect — Wallet-based authentication
 * POST /api/v1/auth/refresh — Refresh access token
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { connectWalletSchema, refreshTokenSchema } from '../../utils/validation.js';
import { generateAccessToken, generateRefreshToken } from '../../middleware/auth.js';
import { errors } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { Keypair, Transaction } from '@stellar/stellar-sdk';
import { UserRepository } from '../../database/repositories/UserRepository.js';
import { config } from '../../config/index.js';

export const authRoutes = Router();

// Stricter rate limiting for auth endpoints
authRoutes.use(authRateLimiter);

/**
 * POST /api/v1/auth/connect
 * Wallet-based authentication — verifies transaction signature and issues JWT
 */
authRoutes.post('/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = connectWalletSchema.parse(req.body);

    // Verify wallet signature against the challenge transaction
    try {
      const passphrases = [
        config.stellar.networkPassphrase,
        'Public Global Stellar Network ; September 2015',
        'Test SDF Network ; September 2015'
      ];
      
      let isValid = false;
      let tx;
      
      for (const passphrase of passphrases) {
        try {
          tx = new Transaction(input.signedTxXdr, passphrase);
          const hash = tx.hash();
          const keypair = Keypair.fromPublicKey(input.publicKey);
          
          for (const sig of tx.signatures) {
            if (keypair.verify(hash, sig.signature())) {
              isValid = true;
              break;
            }
          }
          if (isValid) break;
        } catch (e) {
          // Ignore parse errors, try next passphrase
        }
      }
      
      if (!isValid || !tx) throw errors.unauthorized('Invalid signature');
      
      // Verify operation and timestamp
      if (tx.operations.length !== 1) throw errors.unauthorized('Invalid auth transaction');
      const op = tx.operations[0];
      
      if (!op || op.type !== 'manageData' || op.name !== 'auth' || !op.value) {
        throw new Error('Invalid operation type or missing value');
      }
      
      const timestampStr = op.value.toString('utf-8');
      const timestamp = parseInt(timestampStr, 10);
      
      if (isNaN(timestamp) || Date.now() - timestamp > 5 * 60 * 1000) {
        throw errors.unauthorized('Auth transaction expired');
      }
      
    } catch (error) {
      throw errors.unauthorized('Invalid or expired signature');
    }

    // Upsert user in database
    const user = await UserRepository.upsertByWallet(input.walletAddress);

    // Check if user is a merchant
    const { dbPool } = await import('../../database/index.js');
    const merchantResult = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [input.walletAddress]);
    const isMerchant = merchantResult.rowCount && merchantResult.rowCount > 0;

    // Generate tokens
    const userId = user.id; 
    const role = isMerchant ? 'merchant' : 'user';

    const accessToken = generateAccessToken({
      userId,
      walletAddress: input.walletAddress,
      role,
    });

    const refreshToken = generateRefreshToken({
      userId,
      walletAddress: input.walletAddress,
    });

    logger.info('Wallet connected', { walletAddress: input.walletAddress });

    res.json({
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
      user: {
        id: userId,
        walletAddress: input.walletAddress,
        role,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh token rotation — issues new access + refresh tokens
 */
authRoutes.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = refreshTokenSchema.parse(req.body);

    // TODO: Verify refresh token, check it hasn't been used before
    // (refresh token rotation - each token can only be used once)
    void input.refreshToken; // Will be used in production auth service

    // TODO: Issue new token pair
    // const { accessToken, refreshToken } = await authService.rotateTokens(input.refreshToken);

    res.json({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 900,
    });
  } catch (err) {
    next(err);
  }
});
