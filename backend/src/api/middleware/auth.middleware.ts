import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Logger } from '@/utils/logger';

const logger = new Logger('AuthMiddleware');

export interface JWTPayload {
  userId: string;
  email: string;
}

// Расширяем Request для добавления user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Middleware для проверки JWT токена
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Получаем токен из заголовка
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7); // Убираем "Bearer "

    // Проверяем токен
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }

    const payload = jwt.verify(token, secret) as JWTPayload;

    // Добавляем пользователя в request
    req.user = payload;

    next();
  } catch (error: any) {
    logger.error('Auth middleware error', { error: error.message });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

/**
 * Генерация JWT токена
 */
export const generateToken = (payload: JWTPayload): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  const expiration = process.env.JWT_EXPIRATION || '7d';

  return jwt.sign(payload, secret, {
  expiresIn: expiration as string
} as jwt.SignOptions);
};
