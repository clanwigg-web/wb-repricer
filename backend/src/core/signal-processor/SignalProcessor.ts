import { Logger } from '@/utils/logger';
import prisma from '@/config/database.config';
import { SIGNAL_PRIORITIES, DEFAULT_COOLDOWN_MINUTES } from '@shared/constants';
import type { Signal, SignalType } from '@shared/types/signal.types';
import type { Strategy } from '@shared/types/strategy.types';

export class SignalProcessor {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('SignalProcessor');
  }

  /**
   * Обработать сигнал
   */
  async processSignal(signal: Signal): Promise<void> {
    this.logger.info(`Processing signal: ${signal.type} for SKU ${signal.skuId}`);

    try {
      // 1. Проверка cooldown
      const canProcess = await this.checkCooldown(signal.skuId);
      if (!canProcess) {
        this.logger.info(`SKU ${signal.skuId} is in cooldown, skipping signal`);
        return;
      }

      // 2. Получаем SKU и активную стратегию
      const sku = await prisma.sKU.findUnique({
        where: { id: signal.skuId },
        include: {
          skuStrategies: {
            where: { active: true },
            include: { strategy: true }
          }
        }
      });

      if (!sku || !sku.active) {
        this.logger.info(`SKU ${signal.skuId} not found or inactive`);
        return;
      }

      const activeSkuStrategy = sku.skuStrategies[0];
      if (!activeSkuStrategy) {
        this.logger.info(`SKU ${signal.skuId} has no active strategy`);
        return;
      }

      const strategy = activeSkuStrategy.strategy as any;

      // 3. Проверяем, должна ли стратегия реагировать на этот сигнал
      const shouldReact = this.shouldStrategyReact(strategy, signal);
      if (!shouldReact) {
        this.logger.info(
          `Strategy ${strategy.name} ignores signal ${signal.type}`
        );
        return;
      }

      // 4. Проверяем лимит изменений в день
      const changesCount = await this.getChangesCountToday(signal.skuId);
      if (changesCount >= strategy.maxChangesPerDay) {
        this.logger.info(
          `SKU ${signal.skuId} reached max changes per day (${strategy.maxChangesPerDay})`
        );
        return;
      }

      // 5. Отправляем на репрайсинг (в следующем этапе через очередь)
      // Пока просто логируем
      this.logger.info(`Signal ${signal.type} approved for reprice`);

      // TODO: Добавить в очередь BullMQ
      // await this.queueReprice(sku.id, signal.id, strategy.id);

      // 6. Помечаем сигнал как обработанный
      await prisma.signal.update({
        where: { id: signal.id },
        data: { processed: true }
      });

    } catch (error: any) {
      this.logger.error(`Error processing signal: ${error.message}`, {
        signal: signal.id,
        error: error.stack
      });
      throw error;
    }
  }

  /**
   * Должна ли стратегия реагировать на сигнал
   */
  private shouldStrategyReact(strategy: any, signal: Signal): boolean {
    // Если сигнал в списке игнорируемых
    if (strategy.ignoredSignals && strategy.ignoredSignals.includes(signal.type)) {
      return false;
    }

    // Если есть whitelist сигналов
    if (strategy.allowedSignals && strategy.allowedSignals.length > 0) {
      return strategy.allowedSignals.includes(signal.type);
    }

    // По умолчанию - реагируем
    return true;
  }

  /**
   * Проверка cooldown
   */
  private async checkCooldown(skuId: string): Promise<boolean> {
    const lastChange = await prisma.priceHistory.findFirst({
      where: { skuId },
      orderBy: { time: 'desc' }
    });

    if (!lastChange) {
      return true; // никогда не меняли - можно
    }

    const cooldownPeriod = await this.getCooldownPeriod(skuId);
    const timeSince = Date.now() - lastChange.time.getTime();

    return timeSince >= cooldownPeriod;
  }

  /**
   * Получить период cooldown для SKU
   */
  private async getCooldownPeriod(skuId: string): Promise<number> {
    const skuStrategy = await prisma.sKUStrategy.findFirst({
      where: { skuId, active: true },
      include: { strategy: true }
    });

    const minutes = skuStrategy?.strategy.cooldownMinutes || DEFAULT_COOLDOWN_MINUTES;
    return minutes * 60 * 1000; // в миллисекунды
  }

  /**
   * Получить количество изменений сегодня
   */
  private async getChangesCountToday(skuId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.priceHistory.count({
      where: {
        skuId,
        time: { gte: today }
      }
    });

    return count;
  }

  /**
   * Создать сигнал
   */
  static async createSignal(
    skuId: string,
    type: SignalType,
    data: Record<string, any> = {}
  ): Promise<Signal> {
    const priority = SIGNAL_PRIORITIES[type] || 5;

    const signal = await prisma.signal.create({
      data: {
        skuId,
        type,
        data,
        priority,
        processed: false
      }
    });

    return signal as any;
  }

  /**
   * Получить необработанные сигналы (отсортированные по приоритету)
   */
  static async getUnprocessedSignals(limit: number = 100): Promise<Signal[]> {
    const signals = await prisma.signal.findMany({
      where: { processed: false },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ],
      take: limit
    });

    return signals as any[];
  }
}
