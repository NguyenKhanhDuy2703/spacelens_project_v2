import { registerAs } from '@nestjs/config';

export default registerAs('frontEnd', () => ({
  production: process.env.FRONTEND_URL_PRODUCTION || process.env.PRODUCTION || process.env.production || '',
  dev: process.env.FRONTEND_URL_DEV || process.env.DEV || process.env.dev || 'http://localhost:5173',
}));
