import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Все routes требуют аутентификации
router.use(authMiddleware);

// Overview (Dashboard)
router.get('/overview', analyticsController.getOverview);

// Price Autopsy
router.get('/autopsy/:id', analyticsController.getPriceAutopsy);

// Strategy Health
router.get('/strategy-health/:id', analyticsController.getStrategyHealth);

export default router;
