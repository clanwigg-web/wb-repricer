import { BaseStrategy } from './BaseStrategy';
import type { PriceProposal } from '@shared/types/economics.types';
import type { SKUContext } from '../conditions/ConditionEvaluator';

/**
 * Competitive Hold Strategy
 * 
 * Цель: Быть конкурентным, но не дешевле всех
 * 
 * Логика:
 * - Ориентируемся на топ конкурентов в наличии
 * - Держимся в цене возле медианы
 * - Игнорируем агрессивных демперов (нижние 20%)
 */
export class CompetitiveHoldStrategy extends BaseStrategy {
  async execute(context: SKUContext): Promise<PriceProposal> {
    const { marketData } = context;

    // Берём цены конкурентов из реальных данных
    const prices = this.getCompetitorPrices(marketData);

    if (prices.length === 0) {
      // Нет данных конкурентов — держим текущую цену
      return {
        price: context.sku.currentPrice,
        reason: 'Competitive Hold — нет данных конкурентов, цена не меняется',
        confidence: 0.3
      };
    }

    // Убираем нижние 20% (демперы)
    const filtered = this.removeLowest(prices, 0.2);

    // Берём медиану оставшихся
    const targetPrice = this.median(filtered);

    // Не менять цену если разница менее 2% (шум)
    const currentPrice = context.sku.currentPrice;
    const delta = Math.abs(targetPrice - currentPrice) / currentPrice;
    if (delta < 0.02) {
      return {
        price: currentPrice,
        reason: `Competitive Hold — цена близка к медиане (${targetPrice.toFixed(0)}₽), разница ${(delta * 100).toFixed(1)}%`,
        confidence: 0.7
      };
    }

    return {
      price: Math.round(targetPrice),
      reason: `Competitive Hold — медиана конкурентов (без демперов): ${targetPrice.toFixed(0)}₽, конкурентов: ${prices.length}`,
      confidence: 0.8
    };
  }

  /**
   * Извлекаем массив цен конкурентов из контекста
   */
  private getCompetitorPrices(marketData: any): number[] {
    // Если есть массив competitors с реальными ценами — берём их
    if (marketData.competitors && Array.isArray(marketData.competitors)) {
      return marketData.competitors
        .filter((c: any) => c.inStock && c.priceWithDiscount > 0)
        .map((c: any) => c.priceWithDiscount);
    }

    // Иначе если есть хотя бы medianPrice — используем его как единственную точку
    if (marketData.medianPrice > 0) {
      return [marketData.medianPrice];
    }

    return [];
  }
}

