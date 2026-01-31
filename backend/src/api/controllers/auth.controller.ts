import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/config/database.config';
import { generateToken } from '@/api/middleware/auth.middleware';
import { Logger } from '@/utils/logger';

const logger = new Logger('AuthController');

// Validation schemas
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    wbApiKey: z.string().optional()
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string()
  })
});

/**
 * Регистрация нового пользователя
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, wbApiKey } = req.body;

    // Проверяем, существует ли пользователь
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists'
      });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаём пользователя
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        wbApiKey
      },
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    });

    // Генерируем токен
    const token = generateToken({
      userId: user.id,
      email: user.email
    });

    logger.info(`User registered: ${user.email}`);

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token
    });

  } catch (error: any) {
    logger.error('Registration failed', { 
      error: error.message,
      stack: error.stack,
      email: req.body.email 
    });
    console.error('REGISTRATION ERROR:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Registration failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Вход пользователя
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Проверяем пароль
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Генерируем токен
    const token = generateToken({
      userId: user.id,
      email: user.email
    });

    logger.info(`User logged in: ${user.email}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email
      },
      token
    });

  } catch (error: any) {
    logger.error('Login failed', { 
      error: error.message,
      stack: error.stack,
      email: req.body.email 
    });
    console.error('LOGIN ERROR:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Получить информацию о текущем пользователе
 */
export const me = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        wbApiKey: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    res.json({ user });

  } catch (error: any) {
    logger.error('Failed to get user info', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user info'
    });
  }
};
