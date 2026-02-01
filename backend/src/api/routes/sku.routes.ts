import { Router } from 'express';
import * as skuController from '../controllers/sku.controller';
import { validate } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Все routes требуют аутентификации
router.use(authMiddleware);

// WB API карточки (для автокомплита) — ДОЛЖЕН быть перед /:id !
router.get('/wb-cards', skuController.getWBCards);

// CRUD operations
router.get('/', skuController.getSKUs);
router.get('/:id', skuController.getSKU);
router.post(
  '/',
  validate(skuController.createSKUSchema),
  skuController.createSKU
);
router.patch(
  '/:id',
  validate(skuController.updateSKUSchema),
  skuController.updateSKU
);
router.delete('/:id', skuController.deleteSKU);

// Manual reprice
router.post('/:id/reprice', skuController.triggerReprice);

export default router;
