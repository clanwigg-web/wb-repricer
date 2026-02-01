import { Logger } from '@/utils/logger';
import prisma from '@/config/database.config';
import { StrategyEngine } from '../engines/strategy-engine/StrategyEngine';
import { UnitEconomicsEngine } from '../engines/economics-engine/UnitEconomicsEngine';
import type { SKUContext } from '../engines/strategy-engine/conditions/ConditionEvaluator';
import type { Signal } from '@shared/types/signal.types';
import type { Strategy } from '@shared/types/strategy.types';
import type { PriceChangeResult } from '@shared/types/economics.types';

export interface RepriceResult {
  success: boolean;
  skuId: string;
  oldPrice: number;
  newPrice?: number;
  reason?: string;
  error?: string;
  validationErrors?: any[];
  timestamp: Date;
  duration: number;
}

export class RepriceOrchestrator {
  private strategyEngine: StrategyEngine;
  private economicsEngine: UnitEconomicsEngine;
  private logger: Logger;

  constructor() {
    this.strategyEngine = new StrategyEngine();
    this.economicsEngine = new UnitEconomicsEngine();
    this.logger = new Logger('RepriceOrchestrator');
  }

  /**
   * Главный метод репрайсинга
   */
  async reprice(
    skuId: string,
    signal?: Signal
  ): Promise<RepriceResult> {
    const startTime = Date.now();
    
    this.logger.info(`Starting reprice for SKU ${skuId}`, { signal: signal?.type });

    try {
      // ШАГ 1: Получаем SKU с активной стратегией
      const sku = await this.getSKU(skuId);
      
      if (!sku) {
        return {
          success: false,
          skuId,
          oldPrice: 0,
          error: 'SKU not found',
          timestamp: new Date(),
          duration: Date.now() - startTime
        };
      }

      if (!sku.active) {
        return {
          success: false,
          skuId,
          oldPrice: Number(sku.currentPrice) || 0,
          error: 'SKU is not active',
          timestamp: new Date(),
          duration: Date.now() - startTime
        };
      }

      const activeStrategy = await this.getActiveStrategy(skuId);
      
      if (!activeStrategy) {
        return {
          success: false,
          skuId,
          oldPrice: Number(sku.currentPrice) || 0,
          error: 'No active strategy found',
          timestamp: new Date(),
          duration: Date.now() - startTime
        };
      }

      // ШАГ 2: Получаем рыночные данные
      const marketData = await this.getMarketData(skuId);

      // ШАГ 3: Строим контекст
      const context: SKUContext = {
        sku: {
          id: sku.id,
          currentPrice: Number(sku.currentPrice) || 0,
          position: sku.position,
          economics: UnitEconomicsEngine.extractEconomicsFromSKU(sku)
        },
        marketData
      };

      // ШАГ 4: Оцениваем стратегию
      const priceProposal = await this.strategyEngine.evaluateStrategy(
        context,
        activeStrategy
      );

      if (!priceProposal) {
        return {
          success: false,
          skuId,
          oldPrice: Number(sku.currentPrice) || 0,
          reason: 'Strategy did not produce a price proposal',
          timestamp: new Date(),
          duration: Date.now() - startTime
        };
      }

      // ШАГ 5: Проверяем экономику
      const validation = this.economicsEngine.validatePrice(
        priceProposal.price,
        context.sku.economics,
        activeStrategy.constraints
      );

      if (!validation.valid) {
        this.logger.warn(`Price rejected by economics`, {
          skuId,
          proposedPrice: priceProposal.price,
          errors: validation.errors
        });

        // Сохраняем отклонение для анализа (Price Autopsy)
        await this.logRejection(sku.id, priceProposal, validation);

        return {
          success: false,
          skuId,
          oldPrice: Number(sku.currentPrice) || 0,
          reason: 'Price rejected by economics',
          validationErrors: validation.errors,
          timestamp: new Date(),
          duration: Date.now() - startTime
        };
      }

      // ШАГ 6: Выполняем изменение цены
      const oldPrice = Number(sku.currentPrice) || 0;
      const newPrice = priceProposal.price;

      // Обновляем цену в БД
      await prisma.sKU.update({
        where: { id: sku.id },
        data: { currentPrice: newPrice }
      });

      // Записываем в историю
      await prisma.priceHistory.create({
        data: {
          skuId: sku.id,
          price: newPrice,
          strategyId: activeStrategy.id,
          signalType: signal?.type,
          reason: priceProposal.reason,
          profit: validation.profit,
          margin: validation.margin
        }
      });

      // ШАГ 7: TODO - отправить в WB API (в следующем этапе)
      
      this.logger.info(`Reprice completed`, {
        skuId,
        oldPrice,
        newPrice,
        delta: newPrice - oldPrice,
        reason: priceProposal.reason
      });

      return {
        success: true,
        skuId,
        oldPrice,
        newPrice,
        reason: priceProposal.reason,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };

    } catch (error: any) {
      this.logger.error(`Reprice failed`, {
        skuId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        skuId,
        oldPrice: 0,
        error: error.message,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Получить SKU из БД
   */
  private async getSKU(skuId: string) {
    return prisma.sKU.findUnique({
      where: { id: skuId }
    });
  }

  /**
   * Получить активную стратегию для SKU
   */
  private async getActiveStrategy(skuId: string): Promise<Strategy | null> {
    const skuStrategy = await prisma.sKUStrategy.findFirst({
      where: {
        skuId,
        active: true
      },
      include: {
        strategy: true
      }
    });

    if (!skuStrategy) {
      return null;
    }

    return skuStrategy.strategy as any;
  }

  /**
   * Получить рыночные данные
   */
  private async getMarketData(skuId: string) {
    const marketData = await prisma.marketData.findFirst({
      where: { skuId },
      orderBy: { fetchedAt: 'desc' }
    });

    if (!marketData) {
      this.logger.warn(`No market data found for SKU ${skuId}, using defaults`);
      return {
        minPrice: 0,
        maxPrice: 0,
        medianPrice: 0,
        competitorCount: 0,
        competitors: []
      };
    }

    // competitors хранится как JSON массив в БД
    let competitors: any[] = [];
    try {
      competitors = Array.isArray(marketData.competitors) ? marketData.competitors : [];
    } catch {
      competitors = [];
    }

    return {
      minPrice: Number(marketData.minPrice) || 0,
      maxPrice: Number(marketData.maxPrice) || 0,
      medianPrice: Number(marketData.medianPrice) || 0,
      competitorCount: competitors.length,
      competitors
    };
  }

  /**
   * Записать отклонённое изменение цены
   */
  private async logRejection(
    skuId: string,
    priceProposal: any,
    validation: any
  ): Promise<void> {
    await prisma.priceRejection.create({
      data: {
        skuId,
        proposedPrice: priceProposal.price,
        rejectionReason: 'Economics validation failed',
        validationErrors: validation.errors
      }
    });
  }
}
