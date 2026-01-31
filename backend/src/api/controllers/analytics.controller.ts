import { Request, Response } from 'express';
import prisma from '@/config/database.config';
import { UnitEconomicsEngine } from '@/core/engines/economics-engine/UnitEconomicsEngine';
import { Logger } from '@/utils/logger';

const logger = new Logger('AnalyticsController');

/**
 * Price Autopsy - подробный анализ текущей цены SKU
 */
export const getPriceAutopsy = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Получаем SKU с активной стратегией
    const sku = await prisma.sKU.findFirst({
      where: {
        id,
        userId: req.user.userId
      },
      include: {
        skuStrategies: {
          where: { active: true },
          include: { strategy: true }
        },
        priceHistory: {
          orderBy: { time: 'desc' },
          take: 1
        },
        priceRejections: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!sku) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'SKU not found'
      });
    }

    const activeStrategy = sku.skuStrategies[0]?.strategy;
    const lastPriceChange = sku.priceHistory[0];

    // Рассчитываем экономику
    const economics = UnitEconomicsEngine.extractEconomicsFromSKU(sku);
    const economicsEngine = new UnitEconomicsEngine();
    const currentPrice = Number(sku.currentPrice) || 0;
    
    const profit = economicsEngine.calculateProfit(currentPrice, economics);
    const margin = economicsEngine.calculateMargin(currentPrice, economics);
    const breakeven = economicsEngine.calculateBreakeven(economics);

    // Получаем последний сигнал
    const lastSignal = await prisma.signal.findFirst({
      where: {
        skuId: id,
        processed: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Формируем autopsy
    const autopsy = {
      skuId: id,
      wbSkuId: sku.wbSkuId,
      name: sku.name,
      currentPrice,
      
      activeStrategy: activeStrategy ? {
        id: activeStrategy.id,
        name: activeStrategy.name,
        type: activeStrategy.type
      } : null,
      
      lastSignal: lastSignal ? {
        type: lastSignal.type,
        timestamp: lastSignal.createdAt,
        data: lastSignal.data
      } : null,
      
      economics: {
        currentProfit: profit,
        currentMargin: margin,
        breakeven,
        costPrice: Number(economics.costPrice),
        minAllowedPrice: Math.max(breakeven, currentPrice * 0.8) // Примерно
      },
      
      lastPriceChange: lastPriceChange ? {
        time: lastPriceChange.time,
        price: Number(lastPriceChange.price),
        reason: lastPriceChange.reason,
        strategyId: lastPriceChange.strategyId,
        signalType: lastPriceChange.signalType
      } : null,
      
      recentRejections: sku.priceRejections.map(rejection => ({
        proposedPrice: Number(rejection.proposedPrice),
        reason: rejection.rejectionReason,
        errors: rejection.validationErrors,
        timestamp: rejection.createdAt
      })),
      
      // Проверяем constraints
      constraintsStatus: activeStrategy ? (activeStrategy.constraints as any[]).map((c: any) => {
        let satisfied = true;
        let message = '';

        switch (c.type) {
          case 'min_profit':
            satisfied = profit >= c.value;
            message = satisfied 
              ? `✅ Прибыль ${profit.toFixed(2)}₽ >= минимум ${c.value}₽`
              : `⚠️ Прибыль ${profit.toFixed(2)}₽ < минимум ${c.value}₽`;
            break;
          case 'min_margin':
            satisfied = margin >= c.value;
            message = satisfied
              ? `✅ Маржа ${margin.toFixed(2)}% >= минимум ${c.value}%`
              : `⚠️ Маржа ${margin.toFixed(2)}% < минимум ${c.value}%`;
            break;
        }

        return {
          type: c.type,
          value: c.value,
          satisfied,
          message
        };
      }) : [],
      
      recommendations: []
    };

    // Добавляем рекомендации
    if (profit < 0) {
      autopsy.recommendations.push('⚠️ КРИТИЧНО: Товар продаётся в убыток! Необходимо повысить цену или снизить затраты.');
    } else if (profit < 50) {
      autopsy.recommendations.push('⚠️ Низкая прибыль. Рассмотрите повышение цены.');
    }

    if (currentPrice < breakeven) {
      autopsy.recommendations.push(`⚠️ Цена ниже точки безубыточности (${breakeven}₽). Система не должна была допустить это.`);
    }

    if (!activeStrategy) {
      autopsy.recommendations.push('ℹ️ Нет активной стратегии. Назначьте стратегию для автоматического управления ценой.');
    }

    if (sku.priceRejections.length > 0) {
      autopsy.recommendations.push(`ℹ️ Найдено ${sku.priceRejections.length} отклонённых изменений. Возможно, нужно скорректировать ограничения.`);
    }

    res.json({ autopsy });

  } catch (error: any) {
    logger.error('Failed to get price autopsy', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get price autopsy'
    });
  }
};

/**
 * Получить статистику по стратегии
 */
export const getStrategyHealth = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

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

    // Получаем статистику
    const [
      activeSkuCount,
      priceChanges,
      rejections
    ] = await Promise.all([
      // Количество активных SKU
      prisma.sKUStrategy.count({
        where: {
          strategyId: id,
          active: true
        }
      }),
      
      // Изменения цен за последние 7 дней
      prisma.priceHistory.findMany({
        where: {
          strategyId: id,
          time: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Отклонения за последние 7 дней
      prisma.priceRejection.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    const totalChanges = priceChanges.length;
    const avgChangesPerSku = activeSkuCount > 0 ? totalChanges / activeSkuCount : 0;

    // Рассчитываем средние показатели
    const avgProfit = priceChanges.reduce((sum, pc) => sum + Number(pc.profit || 0), 0) / Math.max(totalChanges, 1);
    const avgMargin = priceChanges.reduce((sum, pc) => sum + Number(pc.margin || 0), 0) / Math.max(totalChanges, 1);

    const rejectionRate = (rejections / Math.max(totalChanges + rejections, 1)) * 100;

    // Оценка здоровья
    let healthScore = 100;
    const issues = [];

    if (rejectionRate > 30) {
      healthScore -= 30;
      issues.push('Высокий процент отклонений (> 30%)');
    }

    if (avgMargin < 10) {
      healthScore -= 20;
      issues.push('Низкая средняя маржа (< 10%)');
    }

    if (avgChangesPerSku > 5) {
      healthScore -= 15;
      issues.push('Слишком частые изменения цен');
    }

    let verdict: 'healthy' | 'overheated' | 'harmful';
    if (healthScore >= 80) verdict = 'healthy';
    else if (healthScore >= 50) verdict = 'overheated';
    else verdict = 'harmful';

    const health = {
      strategyId: id,
      strategyName: strategy.name,
      activeSkuCount,
      totalPriceChanges: totalChanges,
      avgChangesPerSku,
      avgProfit,
      avgMargin,
      rejectionRate,
      healthScore,
      verdict,
      issues,
      recommendations: []
    };

    // Рекомендации
    if (issues.length === 0) {
      health.recommendations.push('✅ Стратегия работает хорошо');
    } else {
      if (rejectionRate > 30) {
        health.recommendations.push('Рассмотрите смягчение ограничений (constraints)');
      }
      if (avgMargin < 10) {
        health.recommendations.push('Стратегия слишком агрессивна - снижает маржу');
      }
      if (avgChangesPerSku > 5) {
        health.recommendations.push('Увеличьте cooldown или уменьшите maxChangesPerDay');
      }
    }

    res.json({ health });

  } catch (error: any) {
    logger.error('Failed to get strategy health', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get strategy health'
    });
  }
};

/**
 * Общая статистика (Dashboard)
 */
export const getOverview = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalSkus,
      activeSkus,
      activeStrategies,
      safeModeSKUs,
      todayChanges,
      todayRejections
    ] = await Promise.all([
      prisma.sKU.count({ where: { userId: req.user.userId } }),
      prisma.sKU.count({ where: { userId: req.user.userId, active: true } }),
      prisma.strategy.count({ where: { userId: req.user.userId, active: true } }),
      // Safe mode - SKU без активной стратегии
      prisma.sKU.count({
        where: {
          userId: req.user.userId,
          active: true,
          skuStrategies: { none: { active: true } }
        }
      }),
      prisma.priceHistory.count({
        where: {
          time: { gte: today }
        }
      }),
      prisma.priceRejection.count({
        where: {
          createdAt: { gte: today }
        }
      })
    ]);

    res.json({
      overview: {
        totalSkus,
        activeSkus,
        activeStrategies,
        safeModeSKUs,
        today: {
          priceChanges: todayChanges,
          rejections: todayRejections
        }
      }
    });

  } catch (error: any) {
    logger.error('Failed to get overview', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get overview'
    });
  }
};
