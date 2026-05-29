import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from './logger.js';
import { config } from '../config/index.js';

let io: SocketIOServer;

export const initSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: config.cors.allowedOrigins,
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized');
  }
  return io;
};
