import { Router } from 'express';
import authRoutes from './auth.routes';
import skuRoutes from './sku.routes';
import strategyRoutes from './strategy.routes';
import analyticsRoutes from './analytics.routes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/skus', skuRoutes);
router.use('/strategies', strategyRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
