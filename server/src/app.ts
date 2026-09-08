import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';

import { CORS_ORIGIN } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/authRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { peopleRouter } from './routes/peopleRoutes.js';

export const createApp = (): Express => {
  const app = express();

  // credentials: true is required for the refresh cookie to cross origins, and is
  // incompatible with origin: '*' — which is why the origin was always pinned.
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api', healthRouter);
  app.use('/api', authRouter);
  app.use('/api', peopleRouter);

  // Order matters: the 404 catch-all must come after the routes, and the error
  // handler must be registered last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
