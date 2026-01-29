import type { Condition, ConditionOperator } from '@shared/types/strategy.types';
import type { UnitEconomics } from '@shared/types/economics.types';

export interface SKUContext {
  sku: {
    id: string;
    currentPrice: number;
    position: number | null;
    economics: UnitEconomics;
  };
  marketData: {
    minPrice: number;
    maxPrice: number;
    medianPrice: number;
    competitorCount: number;
  };
}

export class ConditionEvaluator {
  /**
   * Оценить условие
   */
  async evaluate(condition: Condition, context: SKUContext): Promise<boolean> {
    // Получаем значение метрики
    const actualValue = this.getMetricValue(condition.metric, context);
    
    if (actualValue === undefined || actualValue === null) {
      return false;
    }

    // Оцениваем оператор
    const result = this.evaluateOperator(
      actualValue,
      condition.operator,
      condition.value
    );

    // Обрабатываем составные условия (AND / OR)
    if (condition.and && condition.and.length > 0) {
      for (const subCondition of condition.and) {
        const subResult = await this.evaluate(subCondition, context);
        if (!subResult) return false; // AND logic
      }
    }

    if (condition.or && condition.or.length > 0) {
      let anyTrue = false;
      for (const subCondition of condition.or) {
        const subResult = await this.evaluate(subCondition, context);
        if (subResult) {
          anyTrue = true;
          break;
        }
      }
      if (!anyTrue) return false;
    }

    return result;
  }

  /**
   * Получить значение метрики из контекста
   */
  private getMetricValue(metric: string, context: SKUContext): any {
    const { sku, marketData } = context;

    switch (metric) {
      case 'position':
        return sku.position;
      
      case 'my_price':
      case 'current_price':
        return sku.currentPrice;
      
      case 'competitor_min_price':
        return marketData.minPrice;
      
      case 'competitor_max_price':
        return marketData.maxPrice;
      
      case 'competitor_median_price':
        return marketData.medianPrice;
      
      case 'competitor_count':
        return marketData.competitorCount;
      
      case 'margin':
        return this.calculateMargin(sku.currentPrice, sku.economics);
      
      case 'profit':
        return this.calculateProfit(sku.currentPrice, sku.economics);
      
      // Можно добавить больше метрик
      default:
        return undefined;
    }
  }

  /**
   * Оценить оператор сравнения
   */
  private evaluateOperator(
    actual: any,
    operator: ConditionOperator,
    expected: any
  ): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;
      
      case 'neq':
        return actual !== expected;
      
      case 'gt':
        return actual > expected;
      
      case 'gte':
        return actual >= expected;
      
      case 'lt':
        return actual < expected;
      
      case 'lte':
        return actual <= expected;
      
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      
      default:
        return false;
    }
  }

  /**
   * Вспомогательные методы для расчётов
   */
  private calculateProfit(price: number, economics: UnitEconomics): number {
    const afterSPP = price * (1 - economics.spp / 100);
    const commission = afterSPP * (economics.wbCommission / 100);
    const tax = afterSPP * (economics.tax / 100);
    
    return afterSPP - economics.costPrice - commission - economics.logistics - economics.storage - tax;
  }

  private calculateMargin(price: number, economics: UnitEconomics): number {
    const profit = this.calculateProfit(price, economics);
    return (profit / price) * 100;
  }
}
