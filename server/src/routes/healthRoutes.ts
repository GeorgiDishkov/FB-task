import { Router } from 'express';
import type { Request, Response } from 'express';

import { getTotalCount } from '../store/peopleStore.js';
import { getUserCount } from '../store/userStore.js';

/** Confirms the snapshot actually loaded, without opening the data endpoint. */
export const getHealthHandler = (_request: Request, response: Response): void => {
  response.json({
    status: 'ok',
    peopleLoaded: getTotalCount(),
    usersLoaded: getUserCount(),
  });
};

export const healthRouter = Router();

healthRouter.get('/health', getHealthHandler);
