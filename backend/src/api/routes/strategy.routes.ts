import { Router } from 'express';
import * as strategyController from '../controllers/strategy.controller';
import { validate } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Все routes требуют аутентификации
router.use(authMiddleware);

// Templates
router.get('/templates', strategyController.getTemplates);

// CRUD operations
router.get('/', strategyController.getStrategies);
router.get('/:id', strategyController.getStrategy);
router.post(
  '/',
  validate(strategyController.createStrategySchema),
  strategyController.createStrategy
);
router.patch('/:id', strategyController.updateStrategy);
router.delete('/:id', strategyController.deleteStrategy);

// SKU operations
router.post('/:id/attach', strategyController.attachToSKU);
router.post('/:id/activate', strategyController.activateForSKU);

export default router;
