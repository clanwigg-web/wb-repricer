import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post(
  '/register',
  validate(authController.registerSchema),
  authController.register
);

router.post(
  '/login',
  validate(authController.loginSchema),
  authController.login
);

// Protected routes
router.get('/me', authMiddleware, authController.me);
router.patch('/me', authMiddleware, authController.updateMe);

export default router;
