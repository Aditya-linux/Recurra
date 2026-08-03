/**
 * Recurra Backend — Main Entry Point
 * 
 * Express.js + Apollo GraphQL server with comprehensive security middleware.
 * 
 * @security Stack:
 * - Helmet (security headers)
 * - CORS (origin restriction)
 * - Rate limiting (IP + API key)
 * - JWT authentication
 * - Input validation (Zod)
 * - Structured logging with PII redaction
 */

// ── All imports consolidated at top ──
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import xss from 'xss-clean';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { expressMiddleware } from '@apollo/server/express4';

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { ipRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { checkDatabaseConnection, dbPool } from './database/index.js';
import { initRedis } from './utils/redis.js';
import { initSocket } from './utils/socket.js';
import { getRPCEndpoints } from './utils/rpcFailover.js';

// Routes
import { authRoutes } from './api/routes/auth.js';
import { userRoutes } from './api/routes/user.js';
import { merchantRoutes } from './api/routes/merchant.js';
import { subscriptionRoutes } from './api/routes/subscription.js';
import { webhookRoutes } from './api/routes/webhook.js';
import { plansRoutes } from './api/routes/plans.js';
import { demoMerchantRoutes } from './api/routes/demoMerchant.js';
import { analyticsRoutes } from './api/routes/analytics.js';
import { uploadRoutes } from './api/routes/upload.js';
import { feedbackRoutes } from './api/routes/feedback.js';
import { newFeedbackRoutes } from './api/routes/new-feedback.js';
import paymentsRoutes from './api/routes/payments.js';
import { apolloServer } from './api/graphql/index.js';

// Services
import { WebhookDeliveryService } from './webhooks/WebhookDeliveryService.js';
import { startKeepAlive, stopKeepAlive } from './services/KeepAliveService.js';
import { initKeeperWorker } from './services/keeper.js';
import { startIndexer, stopIndexer } from './services/indexer.js';
import { NotificationScheduler } from './services/NotificationScheduler.js';
import { paymentWatchdog } from './services/watchdog.js';
import { paymentReconciler } from './services/PaymentReconciler.js';

// ============================================================
// APPLICATION SETUP
// ============================================================

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

const app = express();

// Trust the first proxy (e.g. Render/Heroku load balancer)
app.set('trust proxy', 1);

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  maxAge: 86400,
}));

app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(xss());

// Request ID injection
app.use((req, _res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] ?? uuidv4();
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    if (res.statusCode >= 500) logger.error('Request failed', logData);
    else if (res.statusCode >= 400) logger.warn('Client error', logData);
    else logger.info('Request completed', logData);
  });

  next();
});

app.use(ipRateLimiter);

// ============================================================
// HEALTH CHECKS
// ============================================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: config.app.name,
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    environment: config.app.env,
  });
});

app.get('/health/keeper', async (_req, res) => {
  try {
    const result = await dbPool.query(
      `SELECT COUNT(*) AS overdue FROM subscriptions
       WHERE next_payment_time < NOW() - INTERVAL '2 hours'
       AND status IN ('active', 'past_due')`
    );
    const overdueCount = parseInt(result.rows[0].overdue, 10);

    res.json({
      status: overdueCount === 0 ? 'healthy' : 'degraded',
      overdueSubscriptions: overdueCount,
      timestamp: new Date().toISOString(),
      rpcEndpoints: getRPCEndpoints().length,
    });
  } catch {
    res.status(500).json({ status: 'error' });
  }
});

// ============================================================
// API ROUTES (v1)
// ============================================================

app.use(express.static('public'));
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/merchant', merchantRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/plans', plansRoutes);
app.use('/api/v1/demo-merchant', demoMerchantRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/new-feedback', newFeedbackRoutes);
app.use('/api/v1/payments', paymentsRoutes);

// ============================================================
// CATCH-ALL ROUTE FOR REACT ROUTER
// ============================================================

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/graphql')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// ============================================================
// ERROR HANDLING
// ============================================================

Sentry.setupExpressErrorHandler(app);
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// SERVER STARTUP
// ============================================================

let webhookService: WebhookDeliveryService | null = null;

/** Shared graceful shutdown logic (eliminates SIGTERM/SIGINT duplication) */
function gracefulShutdown(signal: string, server: ReturnType<typeof app.listen>): void {
  logger.info(`${signal} received — shutting down gracefully`);
  stopIndexer();
  stopKeepAlive();
  NotificationScheduler.stop();
  paymentWatchdog.stop();
  paymentReconciler.stop();
  webhookService?.close().catch(e => logger.error('Error closing webhook worker', { error: e.message }));
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
}

async function startServer() {
  try {
    // 1. Database
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      logger.warn('⚠️ Bypassing Database Connection Error for local development mode.');
    }

    // 2. Redis
    const redisConnected = await initRedis();
    if (!redisConnected) {
      logger.warn('⚠️ Redis unavailable — webhooks, queues, and caching will be disabled');
    }

    // 3. Webhook Service
    webhookService = new WebhookDeliveryService();

    // 4. Keeper Worker (requires Redis)
    if (redisConnected) {
      initKeeperWorker();
    }

    // 5. Blockchain Event Indexer
    startIndexer();

    // 6. Notification Scheduler
    NotificationScheduler.start();

    // 7. Payment Watchdog (independent of keeper)
    paymentWatchdog.start();

    // 8. Payment Reconciler (catches pending payments from internet failures)
    paymentReconciler.start();

    // 9. Apollo GraphQL
    await apolloServer.start();
    app.use('/graphql', expressMiddleware(apolloServer, {
      context: async ({ req }: { req: any }) => {
        const authHeader = req.headers.authorization || '';
        return { token: authHeader };
      },
    }));

    const server = app.listen(config.app.port, config.app.host, () => {
      logger.info('Recurra API server running', {
        host: config.app.host,
        port: config.app.port,
        environment: config.app.env,
        stellarNetwork: config.stellar.network,
      });
      logger.info(`API Documentation available at http://${config.app.host}:${config.app.port}/api/docs`);
    });

    // WebSockets
    initSocket(server);

    // Keepalive pinger (prevents Render free-tier cold starts)
    startKeepAlive();

    // Graceful shutdown (shared handler eliminates duplication)
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
    process.on('SIGINT', () => gracefulShutdown('SIGINT', server));
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

startServer().catch(err => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Promise rejection', {
    message: reason?.message || String(reason),
    stack: reason?.stack,
    reason,
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  setTimeout(() => process.exit(1), 1000);
});

export default app;
