import { Logger } from '@/utils/logger';
import type { Strategy, StopCondition } from '@shared/types/strategy.types';
import type { PriceProposal } from '@shared/types/economics.types';
import { ConditionEvaluator, type SKUContext } from './conditions/ConditionEvaluator';
import { ActionExecutor } from './actions/ActionExecutor';
import { BaseStrategy } from './strategies/BaseStrategy';
import { CompetitiveHoldStrategy } from './strategies/CompetitiveHoldStrategy';
import { PriceLeaderStrategy } from './strategies/PriceLeaderStrategy';
import { MarginMaximizerStrategy } from './strategies/MarginMaximizerStrategy';

export class StrategyEngine {
  private conditionEvaluator: ConditionEvaluator;
  private actionExecutor: ActionExecutor;
  private logger: Logger;

  constructor() {
    this.conditionEvaluator = new ConditionEvaluator();
    this.actionExecutor = new ActionExecutor();
    this.logger = new Logger('StrategyEngine');
  }

  /**
   * Главный метод оценки стратегии
   */
  async evaluateStrategy(
    context: SKUContext,
    strategy: Strategy
  ): Promise<PriceProposal | null> {
    this.logger.info(`Evaluating strategy: ${strategy.name} for SKU ${context.sku.id}`);

    // 1. Проверка активности
    if (!strategy.active) {
      this.logger.debug('Strategy is not active');
      return null;
    }

    // 2. Проверка stop conditions
    const shouldStop = await this.checkStopConditions(strategy, context);
    if (shouldStop) {
      this.logger.info('Stop conditions met, strategy should stop');
      // TODO: Деактивировать стратегию в БД
      return null;
    }

    // 3. Оценка условий (если они есть)
    if (strategy.conditions && strategy.conditions.length > 0) {
      const conditionsMet = await this.evaluateConditions(strategy.conditions, context);
      if (!conditionsMet) {
        this.logger.debug('Conditions not met');
        return null;
      }
    }

    // 4. Выполнение стратегии
    let proposal: PriceProposal;

    // Если есть actions - используем их
    if (strategy.actions && strategy.actions.length > 0) {
      proposal = await this.executeActions(strategy.actions, context);
    } else {
      // Если нет actions - используем встроенную логику стратегии по типу
      proposal = await this.executeStrategyByType(strategy, context);
    }
    
    this.logger.info(`Strategy produced proposal: ${proposal.price}₽ - ${proposal.reason}`);
    return proposal;
  }

  /**
   * Выполнить встроенную стратегию по типу
   */
  private async executeStrategyByType(
    strategy: Strategy,
    context: SKUContext
  ): Promise<PriceProposal> {
    let strategyInstance: BaseStrategy;

    switch (strategy.type) {
      case 'competitive_hold':
        strategyInstance = new CompetitiveHoldStrategy(strategy);
        break;
      
      case 'price_leader':
        strategyInstance = new PriceLeaderStrategy(strategy);
        break;
      
      case 'margin_maximizer':
        strategyInstance = new MarginMaximizerStrategy(strategy);
        break;
      
      default:
        throw new Error(`Unknown strategy type: ${strategy.type}`);
    }

    return strategyInstance.execute(context);
  }

  /**
   * Оценка условий
   */
  private async evaluateConditions(
    conditions: any[],
    context: SKUContext
  ): Promise<boolean> {
    if (conditions.length === 0) {
      return true;
    }

    // Оцениваем каждое условие (AND logic)
    for (const condition of conditions) {
      const result = await this.conditionEvaluator.evaluate(condition, context);
      
      if (!result) {
        return false;
      }
    }

    return true;
  }

  /**
   * Выполнение действий (actions)
   */
  private async executeActions(
    actions: any[],
    context: SKUContext
  ): Promise<PriceProposal> {
    // Берём первое действие (можно расширить до цепочки)
    const action = actions[0];
    
    if (!action) {
      throw new Error('No actions defined in strategy');
    }

    return this.actionExecutor.execute(action, context);
  }

  /**
   * Проверка условий остановки
   */
  private async checkStopConditions(
    strategy: Strategy,
    context: SKUContext
  ): Promise<boolean> {
    if (!strategy.stopConditions || strategy.stopConditions.length === 0) {
      return false;
    }

    for (const stopCondition of strategy.stopConditions) {
      const met = await this.evaluateStopCondition(stopCondition, context);
      
      if (met) {
        return true;
      }
    }

    return false;
  }

  /**
   * Оценка конкретного stop condition
   */
  private async evaluateStopCondition(
    stopCondition: StopCondition,
    context: SKUContext
  ): Promise<boolean> {
    switch (stopCondition.type) {
      case 'price_reached':
        return context.sku.currentPrice <= stopCondition.value;
      
      case 'position_reached':
        return context.sku.position !== null && context.sku.position <= stopCondition.value;
      
      case 'time_elapsed':
        // TODO: Implement time tracking
        return false;
      
      case 'stock_level':
        // TODO: Implement stock level tracking
        return false;
      
      default:
        return false;
    }
  }
}
