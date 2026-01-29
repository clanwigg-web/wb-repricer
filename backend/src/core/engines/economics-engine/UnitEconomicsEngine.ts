import { Logger } from '@/utils/logger';
import type { UnitEconomics, PriceValidationResult, PriceValidationError } from '@shared/types/economics.types';
import type { Constraint } from '@shared/types/strategy.types';

export class UnitEconomicsEngine {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('UnitEconomicsEngine');
  }

  /**
   * Рассчитать прибыль с единицы товара
   */
  calculateProfit(price: number, economics: UnitEconomics): number {
    const afterSPP = price * (1 - economics.spp / 100);
    const commission = afterSPP * (economics.wbCommission / 100);
    const tax = afterSPP * (economics.tax / 100);
    
    const profit = afterSPP 
      - economics.costPrice 
      - commission 
      - economics.logistics 
      - economics.storage 
      - tax;
    
    return Math.round(profit * 100) / 100; // округляем до копеек
  }

  /**
   * Рассчитать маржу (%)
   */
  calculateMargin(price: number, economics: UnitEconomics): number {
    const profit = this.calculateProfit(price, economics);
    const margin = (profit / price) * 100;
    return Math.round(margin * 100) / 100;
  }

  /**
   * Рассчитать точку безубыточности
   */
  calculateBreakeven(economics: UnitEconomics): number {
    const fixedCosts = economics.costPrice + economics.logistics + economics.storage;
    const variableCostRate = (economics.wbCommission + economics.spp + economics.tax) / 100;
    
    if (variableCostRate >= 1) {
      throw new Error('Variable costs >= 100%, breakeven impossible');
    }
    
    const breakeven = fixedCosts / (1 - variableCostRate);
    return Math.ceil(breakeven); // округляем вверх
  }

  /**
   * ГЛАВНЫЙ МЕТОД: Валидация предложенной цены
   * Проверяет все ограничения (constraints) и возвращает результат
   */
  validatePrice(
    proposedPrice: number,
    economics: UnitEconomics,
    constraints: Constraint[]
  ): PriceValidationResult {
    this.logger.debug('Validating price', { proposedPrice, economics, constraints });

    const profit = this.calculateProfit(proposedPrice, economics);
    const margin = this.calculateMargin(proposedPrice, economics);
    const breakeven = this.calculateBreakeven(economics);
    
    const errors: PriceValidationError[] = [];
    
    // Проверка каждого constraint
    for (const constraint of constraints) {
      if (!constraint.enabled) continue;
      
      const error = this.checkConstraint(
        constraint, 
        proposedPrice, 
        profit, 
        margin, 
        breakeven
      );
      
      if (error) {
        errors.push(error);
      }
    }
    
    // Всегда проверяем безубыток (даже если нет constraint)
    if (proposedPrice < breakeven) {
      const breakevenError: PriceValidationError = {
        type: 'below_breakeven',
        message: `Цена ${proposedPrice}₽ ниже точки безубыточности ${breakeven}₽`,
        critical: true,
        suggestedPrice: breakeven
      };
      
      // Добавляем только если ещё нет такой ошибки
      if (!errors.find(e => e.type === 'below_breakeven')) {
        errors.push(breakevenError);
      }
    }
    
    // Вычисляем минимально допустимую цену
    let suggestedPrice: number | undefined;
    let minAllowedPrice: number | undefined;
    
    if (errors.length > 0) {
      minAllowedPrice = this.calculateMinAllowedPrice(economics, constraints);
      suggestedPrice = minAllowedPrice;
    }
    
    const result: PriceValidationResult = {
      valid: errors.length === 0,
      errors,
      profit,
      margin,
      breakeven,
      suggestedPrice,
      minAllowedPrice
    };

    this.logger.debug('Validation result', result);
    return result;
  }

  /**
   * Проверка конкретного constraint
   */
  private checkConstraint(
    constraint: Constraint,
    price: number,
    profit: number,
    margin: number,
    breakeven: number
  ): PriceValidationError | null {
    switch (constraint.type) {
      case 'min_profit':
        if (profit < constraint.value) {
          return {
            type: 'min_profit_violated',
            message: `Прибыль ${profit.toFixed(2)}₽ меньше минимума ${constraint.value}₽`,
            critical: true,
            suggestedPrice: breakeven + constraint.value
          };
        }
        break;
      
      case 'min_margin':
        if (margin < constraint.value) {
          return {
            type: 'min_margin_violated',
            message: `Маржа ${margin.toFixed(2)}% меньше минимума ${constraint.value}%`,
            critical: true
          };
        }
        break;
      
      case 'min_price':
        if (price < constraint.value) {
          return {
            type: 'min_price_violated',
            message: `Цена ${price}₽ меньше минимума ${constraint.value}₽`,
            critical: true,
            suggestedPrice: constraint.value
          };
        }
        break;
      
      case 'max_price':
        if (price > constraint.value) {
          return {
            type: 'max_price_exceeded',
            message: `Цена ${price}₽ больше максимума ${constraint.value}₽`,
            critical: false,
            suggestedPrice: constraint.value
          };
        }
        break;
      
      case 'max_delta_per_step':
        // TODO: Implement delta check (requires oldPrice)
        break;
      
      default:
        break;
    }
    
    return null;
  }

  /**
   * Вычислить минимально допустимую цену с учётом всех constraints
   */
  private calculateMinAllowedPrice(
    economics: UnitEconomics,
    constraints: Constraint[]
  ): number {
    const breakeven = this.calculateBreakeven(economics);
    let minPrice = breakeven;
    
    for (const constraint of constraints) {
      if (!constraint.enabled) continue;
      
      switch (constraint.type) {
        case 'min_profit':
          const priceForMinProfit = this.calculatePriceForProfit(economics, constraint.value);
          minPrice = Math.max(minPrice, priceForMinProfit);
          break;
        
        case 'min_margin':
          const priceForMinMargin = this.calculatePriceForMargin(economics, constraint.value);
          minPrice = Math.max(minPrice, priceForMinMargin);
          break;
        
        case 'min_price':
          minPrice = Math.max(minPrice, constraint.value);
          break;
      }
    }
    
    return Math.ceil(minPrice);
  }

  /**
   * Рассчитать цену для заданной прибыли
   */
  private calculatePriceForProfit(economics: UnitEconomics, targetProfit: number): number {
    const fixedCosts = economics.costPrice + economics.logistics + economics.storage;
    const variableCostRate = (economics.wbCommission + economics.spp + economics.tax) / 100;
    
    const price = (targetProfit + fixedCosts) / (1 - variableCostRate);
    return price;
  }

  /**
   * Рассчитать цену для заданной маржи
   */
  private calculatePriceForMargin(economics: UnitEconomics, targetMargin: number): number {
    const fixedCosts = economics.costPrice + economics.logistics + economics.storage;
    const variableCostRate = (economics.wbCommission + economics.spp + economics.tax) / 100;
    
    // margin = profit / price
    // profit = price * margin / 100
    // profit = price * (1 - variableCostRate) - fixedCosts
    // price * margin / 100 = price * (1 - variableCostRate) - fixedCosts
    // price * (margin / 100 - (1 - variableCostRate)) = -fixedCosts
    // price = fixedCosts / (1 - variableCostRate - margin / 100)
    
    const denominator = 1 - variableCostRate - targetMargin / 100;
    
    if (denominator <= 0) {
      throw new Error('Cannot achieve target margin with current costs');
    }
    
    const price = fixedCosts / denominator;
    return price;
  }

  /**
   * Получить экономику для SKU из БД
   */
  static extractEconomicsFromSKU(sku: any): UnitEconomics {
    return {
      costPrice: Number(sku.costPrice),
      wbCommission: Number(sku.wbCommission),
      logistics: Number(sku.logistics),
      storage: Number(sku.storage),
      spp: Number(sku.spp),
      tax: Number(sku.tax),
      currency: 'RUB'
    };
  }
}
