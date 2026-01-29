import { BaseStrategy } from './BaseStrategy';
import type { PriceProposal } from '@shared/types/economics.types';
import type { SKUContext } from '../conditions/ConditionEvaluator';

/**
 * Margin Maximizer Strategy
 * 
 * Цель: Максимальная маржа при сохранении продаж
 * 
 * Логика:
 * - Постепенное повышение цены
 * - Пока не падают метрики (позиция, продажи)
 * - Если падение - откат
 */
export class MarginMaximizerStrategy extends BaseStrategy {
  async execute(context: SKUContext): Promise<PriceProposal> {
    const { sku, marketData } = context;
    const currentPrice = sku.currentPrice;
    const position = sku.position;

    // Проверяем позицию и "стабильность" продаж
    // В MVP у нас нет данных о продажах, поэтому только позиция
    const isStrongPosition = position !== null && position <= 5;
    
    if (isStrongPosition) {
      // Повышаем цену на 1-2%
      const increasePercent = 0.02; // 2%
      const targetPrice = currentPrice * (1 + increasePercent);
      
      // Не поднимаем выше медианы конкурентов + 10%
      const maxPrice = marketData.medianPrice * 1.1;
      const actualPrice = Math.min(targetPrice, maxPrice);

      return {
        price: actualPrice,
        reason: `Margin Maximizer - позиция сильная (${position}), повышаем на ${(increasePercent * 100).toFixed(0)}%`,
        confidence: 0.8
      };
    } else {
      // Позиция слабая или неизвестна - не рискуем
      return {
        price: currentPrice,
        reason: 'Margin Maximizer - позиция недостаточно сильная, оставляем цену',
        confidence: 0.6
      };
    }
  }
}
