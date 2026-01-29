import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '@/config/database.config';
import { Logger } from '@/utils/logger';
import { StrategyType } from '@shared/types/strategy.types';

const logger = new Logger('StrategyController');

// Validation schemas
export const createStrategySchema = z.object({
  body: z.object({
    name: z.string(),
    type: z.enum(['competitive_hold', 'price_leader', 'margin_maximizer', 'inventory_driven', 'clearance']),
    conditions: z.array(z.any()).default([]),
    actions: z.array(z.any()).default([]),
    constraints: z.array(z.any()).default([]),
    stopConditions: z.array(z.any()).default([]),
    allowedSignals: z.array(z.string()).default([]),
    ignoredSignals: z.array(z.string()).default([]),
    cooldownMinutes: z.number().default(360),
    maxChangesPerDay: z.number().default(3)
  })
});

/**
 * Получить все стратегии пользователя
 */
export const getStrategies = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const strategies = await prisma.strategy.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            skuStrategies: {
              where: { active: true }
            }
          }
        }
      }
    });

    // Добавляем количество активных SKU для каждой стратегии
    const strategiesWithStats = strategies.map(strategy => ({
      ...strategy,
      activeSKUCount: strategy._count.skuStrategies
    }));

    res.json({ strategies: strategiesWithStats });

  } catch (error: any) {
    logger.error('Failed to get strategies', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get strategies'
    });
  }
};

/**
 * Получить одну стратегию
 */
export const getStrategy = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const strategy = await prisma.strategy.findFirst({
      where: {
        id,
        userId: req.user.userId
      },
      include: {
        skuStrategies: {
          where: { active: true },
          include: {
            sku: {
              select: {
                id: true,
                wbSkuId: true,
                name: true,
                currentPrice: true
              }
            }
          }
        }
      }
    });

    if (!strategy) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Strategy not found'
      });
    }

    res.json({ strategy });

  } catch (error: any) {
    logger.error('Failed to get strategy', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get strategy'
    });
  }
};

/**
 * Создать стратегию
 */
export const createStrategy = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = req.body;

    const strategy = await prisma.strategy.create({
      data: {
        ...data,
        userId: req.user.userId
      }
    });

    logger.info(`Strategy created: ${strategy.id}`);

    res.status(201).json({
      message: 'Strategy created successfully',
      strategy
    });

  } catch (error: any) {
    logger.error('Failed to create strategy', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create strategy'
    });
  }
};

/**
 * Обновить стратегию
 */
export const updateStrategy = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const data = req.body;

    // Проверяем владельца
    const existing = await prisma.strategy.findFirst({
      where: {
        id,
        userId: req.user.userId
      }
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Strategy not found'
      });
    }

    const strategy = await prisma.strategy.update({
      where: { id },
      data
    });

    logger.info(`Strategy updated: ${strategy.id}`);

    res.json({
      message: 'Strategy updated successfully',
      strategy
    });

  } catch (error: any) {
    logger.error('Failed to update strategy', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update strategy'
    });
  }
};

/**
 * Удалить стратегию
 */
export const deleteStrategy = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Проверяем владельца
    const existing = await prisma.strategy.findFirst({
      where: {
        id,
        userId: req.user.userId
      }
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Strategy not found'
      });
    }

    await prisma.strategy.delete({
      where: { id }
    });

    logger.info(`Strategy deleted: ${id}`);

    res.json({
      message: 'Strategy deleted successfully'
    });

  } catch (error: any) {
    logger.error('Failed to delete strategy', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete strategy'
    });
  }
};

/**
 * Получить шаблоны стратегий
 */
export const getTemplates = async (req: Request, res: Response) => {
  try {
    const templates = [
      {
        id: 'competitive_hold',
        name: 'Competitive Hold',
        description: 'Удержание конкурентной позиции без демпинга',
        type: StrategyType.COMPETITIVE_HOLD,
        goal: 'Быть конкурентным, но не дешевле всех',
        howItWorks: [
          'Ориентируется на топ-10 конкурентов',
          'Держится в районе медианы',
          'Игнорирует агрессивных демперов'
        ],
        warnings: ['Может снижать цену при демпинге конкурентов'],
        suitableFor: ['Стабильных товаров', 'Товаров с конкуренцией'],
        defaultConstraints: [
          { type: 'min_profit', value: 100, enabled: true },
          { type: 'min_margin', value: 10, enabled: true }
        ]
      },
      {
        id: 'price_leader',
        name: 'Price Leader (Aggressive)',
        description: 'Захват выдачи и оборота',
        type: StrategyType.PRICE_LEADER,
        goal: 'Забрать выдачу и трафик',
        howItWorks: [
          'Всегда самая выгодная цена',
          'Снижает до заданного порога',
          'Останавливается при достижении топ-3'
        ],
        warnings: ['⚠️ Агрессивная стратегия! Может снизить маржу'],
        suitableFor: ['Запуска нового товара', 'Выхода в топ за короткий период'],
        defaultConstraints: [
          { type: 'min_profit', value: 50, enabled: true },
          { type: 'min_margin', value: 5, enabled: true }
        ]
      },
      {
        id: 'margin_maximizer',
        name: 'Margin Maximizer',
        description: 'Максимизация прибыли',
        type: StrategyType.MARGIN_MAXIMIZER,
        goal: 'Максимальная прибыль при сохранении продаж',
        howItWorks: [
          'Постепенно повышает цену',
          'Следит за позицией и продажами',
          'Откатывается при падении метрик'
        ],
        warnings: [],
        suitableFor: ['Товаров с отзывами и брендом', 'SKU в топ-5 позиции'],
        defaultConstraints: [
          { type: 'min_profit', value: 150, enabled: true },
          { type: 'min_margin', value: 15, enabled: true }
        ]
      }
    ];

    res.json({ templates });

  } catch (error: any) {
    logger.error('Failed to get templates', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get templates'
    });
  }
};

/**
 * Привязать стратегию к SKU
 */
export const attachToSKU = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params; // strategy id
    const { skuId } = req.body;

    // Проверяем владельца стратегии
    const strategy = await prisma.strategy.findFirst({
      where: {
        id,
        userId: req.user.userId
      }
    });

    if (!strategy) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Strategy not found'
      });
    }

    // Проверяем владельца SKU
    const sku = await prisma.sKU.findFirst({
      where: {
        id: skuId,
        userId: req.user.userId
      }
    });

    if (!sku) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'SKU not found'
      });
    }

    // Создаём связь
    const skuStrategy = await prisma.sKUStrategy.upsert({
      where: {
        skuId_strategyId: {
          skuId,
          strategyId: id
        }
      },
      create: {
        skuId,
        strategyId: id,
        active: false
      },
      update: {}
    });

    logger.info(`Strategy ${id} attached to SKU ${skuId}`);

    res.json({
      message: 'Strategy attached to SKU successfully',
      skuStrategy
    });

  } catch (error: any) {
    logger.error('Failed to attach strategy to SKU', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to attach strategy to SKU'
    });
  }
};

/**
 * Активировать стратегию для SKU
 */
export const activateForSKU = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params; // strategy id
    const { skuId } = req.body;

    // Проверяем владельца
    const strategy = await prisma.strategy.findFirst({
      where: {
        id,
        userId: req.user.userId
      }
    });

    if (!strategy) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Strategy not found'
      });
    }

    // Деактивируем все другие стратегии для этого SKU
    await prisma.sKUStrategy.updateMany({
      where: { skuId },
      data: { active: false }
    });

    // Активируем выбранную стратегию
    const skuStrategy = await prisma.sKUStrategy.upsert({
      where: {
        skuId_strategyId: {
          skuId,
          strategyId: id
        }
      },
      create: {
        skuId,
        strategyId: id,
        active: true
      },
      update: {
        active: true
      }
    });

    logger.info(`Strategy ${id} activated for SKU ${skuId}`);

    res.json({
      message: 'Strategy activated for SKU successfully',
      skuStrategy
    });

  } catch (error: any) {
    logger.error('Failed to activate strategy for SKU', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to activate strategy for SKU'
    });
  }
};
