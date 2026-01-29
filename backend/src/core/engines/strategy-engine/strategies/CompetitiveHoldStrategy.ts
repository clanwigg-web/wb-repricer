import { BaseStrategy } from './BaseStrategy';
import type { PriceProposal } from '@shared/types/economics.types';
import type { SKUContext } from '../conditions/ConditionEvaluator';

/**
 * Competitive Hold Strategy
 * 
 * Цель: Быть конкурентным, но не дешевле всех
 * 
 * Логика:
 * - Ориентируемся на топ-10 конкурентов
 * - Держимся в цене возле медианы
 * - Игнорируем агрессивных демперов (нижние 20%)
 */
export class CompetitiveHoldStrategy extends BaseStrategy {
  async execute(context: SKUContext): Promise<PriceProposal> {
    const { marketData } = context;

    // Для MVP: используем просто медианную цену
    // В реальности здесь был бы сбор цен топ-10 конкурентов
    
    // Имитируем топ-10 цен (в реальности из БД market_data)
    const topPrices = this.generateTopPrices(marketData);
    
    // Убираем нижние 20% (демперы)
    const filtered = this.removeLowest(topPrices, 0.2);
    
    // Берём медиану
    const targetPrice = this.median(filtered);
    
    return {
      price: targetPrice,
      reason: 'Competitive Hold - медиана топ-10 конкурентов (без демперов)',
      confidence: 0.8
    };
  }

  /**
   * Генерируем топ-10 цен на основе имеющихся данных
   * В реальности это будет из таблицы market_data
   */
  private generateTopPrices(marketData: any): number[] {
    const { minPrice, maxPrice, medianPrice } = marketData;
    
    // Простая генерация для MVP
    // TODO: Заменить на реальные данные из БД
    const prices: number[] = [];
    const range = maxPrice - minPrice;
    
    for (let i = 0; i < 10; i++) {
      const randomOffset = Math.random() * range;
      prices.push(minPrice + randomOffset);
    }
    
    return prices;
  }
}
