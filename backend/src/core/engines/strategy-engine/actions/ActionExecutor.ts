import type { Action, ActionType } from '@shared/types/strategy.types';
import type { PriceProposal } from '@shared/types/economics.types';
import type { SKUContext } from '../conditions/ConditionEvaluator';

export class ActionExecutor {
  /**
   * Выполнить действие и вернуть предложение по цене
   */
  async execute(action: Action, context: SKUContext): Promise<PriceProposal> {
    const { sku, marketData } = context;

    switch (action.type) {
      case 'set_price':
        return this.setPrice(action, context);
      
      case 'increase_price':
        return this.increasePrice(action, context);
      
      case 'decrease_price':
        return this.decreasePrice(action, context);
      
      case 'follow_competitor':
        return this.followCompetitor(action, context);
      
      case 'set_to_median':
        return this.setToMedian(context);
      
      case 'set_to_breakeven':
        return this.setToBreakeven(context);
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Установить конкретную цену
   */
  private setPrice(action: Action, context: SKUContext): PriceProposal {
    if (!action.value) {
      throw new Error('Action "set_price" requires a value');
    }

    return {
      price: action.value,
      reason: `Установлена цена ${action.value}₽`
    };
  }

  /**
   * Повысить цену
   */
  private increasePrice(action: Action, context: SKUContext): PriceProposal {
    const currentPrice = context.sku.currentPrice;
    
    if (!action.value) {
      throw new Error('Action "increase_price" requires a value');
    }

    const delta = action.mode === 'percentage'
      ? currentPrice * (action.value / 100)
      : action.value;
    
    const newPrice = currentPrice + delta;
    
    return {
      price: newPrice,
      reason: `Повышена цена на ${action.mode === 'percentage' ? action.value + '%' : action.value + '₽'}`
    };
  }

  /**
   * Понизить цену
   */
  private decreasePrice(action: Action, context: SKUContext): PriceProposal {
    const currentPrice = context.sku.currentPrice;
    
    if (!action.value) {
      throw new Error('Action "decrease_price" requires a value');
    }

    const delta = action.mode === 'percentage'
      ? currentPrice * (action.value / 100)
      : action.value;
    
    const newPrice = currentPrice - delta;
    
    return {
      price: newPrice,
      reason: `Снижена цена на ${action.mode === 'percentage' ? action.value + '%' : action.value + '₽'}`
    };
  }

  /**
   * Следовать за конкурентом
   */
  private followCompetitor(action: Action, context: SKUContext): PriceProposal {
    const { marketData } = context;
    const targetPrice = marketData.minPrice;
    
    const delta = action.value || 0;
    const newPrice = action.mode === 'percentage'
      ? targetPrice * (1 - delta / 100)
      : targetPrice - delta;
    
    return {
      price: newPrice,
      reason: `Следование за конкурентом: мин. цена ${targetPrice}₽ - ${delta}${action.mode === 'percentage' ? '%' : '₽'}`
    };
  }

  /**
   * Установить цену в медиану конкурентов
   */
  private setToMedian(context: SKUContext): PriceProposal {
    const { marketData } = context;
    const median = marketData.medianPrice;
    
    return {
      price: median,
      reason: `Установлена медиана конкурентов (${median}₽)`
    };
  }

  /**
   * Установить цену в безубыток
   */
  private setToBreakeven(context: SKUContext): PriceProposal {
    const { sku } = context;
    const economics = sku.economics;
    
    // Упрощенный расчёт breakeven
    const fixedCosts = economics.costPrice + economics.logistics + economics.storage;
    const variableCostRate = (economics.wbCommission + economics.spp + economics.tax) / 100;
    const breakeven = Math.ceil(fixedCosts / (1 - variableCostRate));
    
    return {
      price: breakeven,
      reason: `Установлена цена безубытка (${breakeven}₽)`
    };
  }
}
