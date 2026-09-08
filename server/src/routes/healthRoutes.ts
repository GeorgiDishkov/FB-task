import { Router } from 'express';
import type { Request, Response } from 'express';

import { getTotalCount } from '../store/peopleStore.js';

/** Confirms the snapshot actually loaded, without opening the data endpoint. */
export const getHealthHandler = (_request: Request, response: Response): void => {
  response.json({ status: 'ok', peopleLoaded: getTotalCount() });
};

export const healthRouter = Router();

healthRouter.get('/health', getHealthHandler);
