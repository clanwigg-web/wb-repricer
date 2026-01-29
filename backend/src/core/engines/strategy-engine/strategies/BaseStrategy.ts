import type { Strategy } from '@shared/types/strategy.types';
import type { PriceProposal } from '@shared/types/economics.types';
import type { SKUContext } from '../conditions/ConditionEvaluator';

/**
 * Базовый абстрактный класс для всех стратегий
 */
export abstract class BaseStrategy {
  constructor(protected strategy: Strategy) {}

  /**
   * Главный метод выполнения стратегии
   * Должен быть реализован в наследниках
   */
  abstract execute(context: SKUContext): Promise<PriceProposal>;

  /**
   * Вспомогательный метод: медиана массива
   */
  protected median(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Вспомогательный метод: убрать нижние N% из массива
   */
  protected removeLowest(arr: number[], percent: number): number[] {
    const sorted = [...arr].sort((a, b) => a - b);
    const removeCount = Math.ceil(sorted.length * percent);
    return sorted.slice(removeCount);
  }

  /**
   * Вспомогательный метод: среднее значение
   */
  protected average(arr: number[]): number {
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }
}
