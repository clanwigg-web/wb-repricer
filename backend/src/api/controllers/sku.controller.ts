import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '@/config/database.config';
import { Logger } from '@/utils/logger';

const logger = new Logger('SKUController');

// Validation schemas
export const createSKUSchema = z.object({
  body: z.object({
    wbSkuId: z.string(),
    name: z.string().optional(),
    currentPrice: z.number().optional(),
    costPrice: z.number(),
    wbCommission: z.number().default(15),
    logistics: z.number().default(0),
    storage: z.number().default(0),
    spp: z.number().default(0),
    tax: z.number().default(6)
  })
});

export const updateSKUSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    currentPrice: z.number().optional(),
    active: z.boolean().optional(),
    costPrice: z.number().optional(),
    wbCommission: z.number().optional(),
    logistics: z.number().optional(),
    storage: z.number().optional(),
    spp: z.number().optional(),
    tax: z.number().optional()
  })
});

/**
 * Получить список карточек товаров с WB API (для автокомплита)
 * GET /skus/wb-cards?search=текст
 */
export const getWBCards = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Грузим токен пользователя
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { wbApiKey: true }
    });

    if (!user?.wbApiKey) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'WB API key not configured. Go to Settings to add your token.'
      });
    }

    const { search } = req.query;
    const { WBApiClient } = await import('@/services/wb-api/WBApiClient');
    const wbClient = new WBApiClient(user.wbApiKey);

    const cards = await wbClient.getCardsList(
      search ? String(search) : undefined,
      100
    );

    res.json({ cards });

  } catch (error: any) {
    logger.error('Failed to fetch WB cards', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch cards from Wildberries'
    });
  }
};

/**
 * Получить все SKU пользователя
 */
export const getSKUs = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { active, page = '1', limit = '50' } = req.query;

    const where: any = { userId: req.user.userId };
    if (active !== undefined) {
      where.active = active === 'true';
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [skus, total] = await Promise.all([
      prisma.sKU.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          skuStrategies: {
            where: { active: true },
            include: { strategy: true }
          }
        }
      }),
      prisma.sKU.count({ where })
    ]);

    res.json({
      skus,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error: any) {
    logger.error('Failed to get SKUs', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get SKUs'
    });
  }
};

/**
 * Получить один SKU
 */
export const getSKU = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const sku = await prisma.sKU.findFirst({
      where: {
        id,
        userId: req.user.userId
      },
      include: {
        skuStrategies: {
          include: { strategy: true }
        },
        priceHistory: {
          orderBy: { time: 'desc' },
          take: 10
        }
      }
    });

    if (!sku) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'SKU not found'
      });
    }

    res.json({ sku });

  } catch (error: any) {
    logger.error('Failed to get SKU', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get SKU'
    });
  }
};

/**
 * Создать SKU
 */
export const createSKU = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = req.body;

    // Проверяем, не существует ли уже такой SKU
    const existing = await prisma.sKU.findFirst({
      where: {
        userId: req.user.userId,
        wbSkuId: data.wbSkuId
      }
    });

    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'SKU with this wbSkuId already exists'
      });
    }

    const sku = await prisma.sKU.create({
      data: {
        ...data,
        userId: req.user.userId
      }
    });

    logger.info(`SKU created: ${sku.id}`);

    res.status(201).json({
      message: 'SKU created successfully',
      sku
    });

  } catch (error: any) {
    logger.error('Failed to create SKU', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create SKU'
    });
  }
};

/**
 * Обновить SKU
 */
export const updateSKU = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const data = req.body;

    // Проверяем владельца
    const existing = await prisma.sKU.findFirst({
      where: {
        id,
        userId: req.user.userId
      }
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'SKU not found'
      });
    }

    const sku = await prisma.sKU.update({
      where: { id },
      data
    });

    logger.info(`SKU updated: ${sku.id}`);

    res.json({
      message: 'SKU updated successfully',
      sku
    });

  } catch (error: any) {
    logger.error('Failed to update SKU', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update SKU'
    });
  }
};

/**
 * Удалить SKU
 */
export const deleteSKU = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Проверяем владельца
    const existing = await prisma.sKU.findFirst({
      where: {
        id,
        userId: req.user.userId
      }
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'SKU not found'
      });
    }

    await prisma.sKU.delete({
      where: { id }
    });

    logger.info(`SKU deleted: ${id}`);

    res.json({
      message: 'SKU deleted successfully'
    });

  } catch (error: any) {
    logger.error('Failed to delete SKU', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete SKU'
    });
  }
};

/**
 * Триггернуть ручной репрайсинг
 */
export const triggerReprice = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Проверяем владельца
    const sku = await prisma.sKU.findFirst({
      where: {
        id,
        userId: req.user.userId
      }
    });

    if (!sku) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'SKU not found'
      });
    }

    // Получаем активную стратегию
    const skuStrategy = await prisma.sKUStrategy.findFirst({
      where: {
        skuId: id,
        active: true
      }
    });

    if (!skuStrategy) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No active strategy found for this SKU'
      });
    }

    // Добавляем в очередь
    const queueManager = (await import('@/queue/QueueManager')).default;
    await queueManager.addRepriceJob({
      skuId: id,
      strategyId: skuStrategy.strategyId,
      force: true // Игнорируем cooldown
    }, {
      priority: 10 // Высокий приоритет для ручного запуска
    });

    logger.info(`Manual reprice triggered for SKU: ${id}`);

    res.json({
      message: 'Reprice job added to queue',
      skuId: id
    });

  } catch (error: any) {
    logger.error('Failed to trigger reprice', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to trigger reprice'
    });
  }
};
