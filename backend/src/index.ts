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

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import xss from 'xss-clean';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { ipRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRoutes } from './api/routes/auth.js';
import { userRoutes } from './api/routes/user.js';
import { merchantRoutes } from './api/routes/merchant.js';
import { subscriptionRoutes } from './api/routes/subscription.js';
import { webhookRoutes } from './api/routes/webhook.js';
import { expressMiddleware } from '@apollo/server/express4';
import { apolloServer } from './api/graphql/index.js';
import { checkDatabaseConnection } from './database/index.js';
import { startIndexer, stopIndexer } from './services/indexer.js';
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// ============================================================
// APPLICATION SETUP
// ============================================================

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

const app = express();

// Trust the first proxy (e.g. Render/Heroku load balancer) to fix rate limiter IP detection
app.set('trust proxy', 1);

// ============================================================
// SECURITY MIDDLEWARE (Applied globally)
// ============================================================

// Security headers (Helmet)
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
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS — restrict to allowed origins
app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  maxAge: 86400, // 24 hours
}));

// Compression
app.use(compression());

// Body parsing with size limits (prevent payload attacks)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Sanitize data against XSS
app.use(xss());

// Request ID injection for tracing
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

    if (res.statusCode >= 500) {
      logger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Client error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
});

// Global rate limiting
app.use(ipRateLimiter);

// ============================================================
// HEALTH CHECK (No auth required)
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

// ============================================================
// API ROUTES (v1)
// ============================================================

import { plansRoutes } from './api/routes/plans.js';
import { demoMerchantRoutes } from './api/routes/demoMerchant.js';
import { analyticsRoutes } from './api/routes/analytics.js';
import { uploadRoutes } from './api/routes/upload.js';
import { feedbackRoutes } from './api/routes/feedback.js';
import paymentsRoutes from './api/routes/payments.js';

// Serve static files from the public directory and frontend build
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
app.use('/api/v1/payments', paymentsRoutes);

// ============================================================
// CATCH-ALL ROUTE FOR REACT ROUTER
// ============================================================
// Any route not matching the APIs above should serve the frontend application
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

import { WebhookDeliveryService } from './webhooks/WebhookDeliveryService.js';
import { initSocket } from './utils/socket.js';
import { startKeepAlive, stopKeepAlive } from './services/KeepAliveService.js';
import { initRedis } from './utils/redis.js';
import { initKeeperWorker } from './services/keeper.js';
import { NotificationScheduler } from './services/NotificationScheduler.js';

let webhookService: WebhookDeliveryService | null = null;

async function startServer() {
  try {
    // 1. Test Database Connection (Bypassed for local dev without Docker)
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      logger.warn("⚠️ Bypassing Database Connection Error for local development mode.");
    }

    // 2. Initialize Redis (optional in development)
    const redisConnected = await initRedis();
    if (!redisConnected) {
      logger.warn('⚠️ Redis unavailable — webhooks, queues, and caching will be disabled');
    }

    // 3. Initialize Webhook Service (only if Redis is up)
    webhookService = new WebhookDeliveryService();

    // 4. Initialize Keeper Worker (only if Redis is up)
    if (redisConnected) {
      initKeeperWorker();
    }
    
    // 5. Start Blockchain Event Indexer
    startIndexer();

    // Start Daily Notification Scheduler
    NotificationScheduler.start();

    // 6. Start Apollo GraphQL server
    await apolloServer.start();
    app.use('/graphql', expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        // Very basic context, should integrate with real JWT validation
        const authHeader = req.headers.authorization || '';
        return { token: authHeader };
      },
    }));

    const server = app.listen(config.app.port, config.app.host, () => {
      logger.info(` Recurra API server running`, {
        host: config.app.host,
        port: config.app.port,
        environment: config.app.env,
        stellarNetwork: config.stellar.network,
      });
      logger.info(`API Documentation available at http://${config.app.host}:${config.app.port}/api/docs`);
    });

    // Initialize WebSockets
    initSocket(server);

    // Start keepalive pinger (prevents Render free-tier cold starts)
    startKeepAlive();

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received — shutting down gracefully');
      stopIndexer();
      stopKeepAlive();
      NotificationScheduler.stop();
      webhookService?.close().catch(e => logger.error('Error closing webhook worker', { error: e.message }));
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received — shutting down gracefully');
      stopIndexer();
      stopKeepAlive();
      NotificationScheduler.stop();
      webhookService?.close().catch(e => logger.error('Error closing webhook worker', { error: e.message }));
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

startServer().catch(err => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});

// Unhandled rejections — log but don't crash in development
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Promise rejection', { 
    message: reason?.message || String(reason),
    stack: reason?.stack,
    reason 
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  setTimeout(() => process.exit(1), 1000);
});

export default app;
