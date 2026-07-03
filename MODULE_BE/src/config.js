/**
 * src/config.js — Centralized config reader
 * Đọc biến môi trường từ root .env (prefix theo service).
 * Toàn bộ code khác chỉ import từ file này, KHÔNG đọc process.env trực tiếp.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

module.exports = {
  // Shared
  NODE_ENV:   process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  REDIS_URL:  process.env.REDIS_URL  || 'redis://localhost:6379',

  // Gateway
  gateway: {
    port:       parseInt(process.env.GATEWAY_PORT) || 3000,
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },

  // Auth service
  auth: {
    port:      parseInt(process.env.AUTH_PORT) || 3001,
    dbName:    process.env.AUTH_DB_NAME    || 'spacelens_auth',
    jwtSecret: process.env.AUTH_JWT_SECRET || 'fallback-secret',
    jwtExpire: process.env.AUTH_JWT_EXPIRES_IN || '7d',
  },

  // Camera service
  camera: {
    port:   parseInt(process.env.CAMERA_PORT) || 3002,
    dbName: process.env.CAMERA_DB_NAME || 'spacelens_camera',
  },

  // Zone service
  zone: {
    port:   parseInt(process.env.ZONE_PORT) || 3003,
    dbName: process.env.ZONE_DB_NAME || 'spacelens_zone',
  },

  // Analytics service
  analytics: {
    port:               parseInt(process.env.ANALYTICS_PORT) || 3004,
    dbName:             process.env.ANALYTICS_DB_NAME || 'spacelens_analytics',
    workerConcurrency:  parseInt(process.env.ANALYTICS_WORKER_CONCURRENCY) || 2,
  },

  // Report service
  report: {
    port:   parseInt(process.env.REPORT_PORT) || 3005,
    dbName: process.env.REPORT_DB_NAME || 'spacelens_report',
  },

  // AI module
  ai: {
    url: process.env.AI_MODULE_URL || 'http://localhost:5000',
  },
};
