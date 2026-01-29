import { BaseStrategy } from './BaseStrategy';
import type { PriceProposal } from '@shared/types/economics.types';
import type { SKUContext } from '../conditions/ConditionEvaluator';

/**
 * Price Leader (Aggressive) Strategy
 * 
 * Цель: Забрать выдачу, оборот и трафик
 * 
 * Логика:
 * - Быть самым выгодным предложением
 * - Но только до заданного порога
 * - Остановиться при достижении топ-3
 */
export class PriceLeaderStrategy extends BaseStrategy {
  async execute(context: SKUContext): Promise<PriceProposal> {
    const { sku, marketData } = context;
    const currentPosition = sku.position;

    // Если уже в топ-3, можно ослабить агрессию
    if (currentPosition !== null && currentPosition <= 3) {
      return {
        price: sku.currentPrice,
        reason: 'Price Leader - уже в топ-3, не снижаем цену',
        confidence: 0.9
      };
    }

    // Агрессивно снижаем: минимальная цена конкурента - 2%
    const minCompetitorPrice = marketData.minPrice;
    const targetPrice = minCompetitorPrice * 0.98; // -2%
    
    // Не снижаем больше чем на 10% за раз
    const maxDelta = sku.currentPrice * 0.1;
    const actualPrice = Math.max(targetPrice, sku.currentPrice - maxDelta);

    return {
      price: actualPrice,
      reason: `Price Leader - ниже минимального конкурента (${minCompetitorPrice}₽) на 2%`,
      confidence: 0.7
    };
  }
}
