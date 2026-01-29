import cron from 'node-cron';
import { Logger } from '@/utils/logger';
import prisma from '@/config/database.config';
import queueManager from '@/queue/QueueManager';

const logger = new Logger('Scheduler');

/**
 * Планировщик периодических задач
 */
export class Scheduler {
  private tasks: cron.ScheduledTask[] = [];

  /**
   * Запустить все задачи
   */
  start() {
    logger.info('Starting scheduler...');

    // Задача 1: Сбор данных каждые 30 минут
    const fetchDataTask = cron.schedule('*/30 * * * *', async () => {
      logger.info('Running scheduled data fetch');
      await this.scheduleFetchDataJobs();
    });
    this.tasks.push(fetchDataTask);

    // Задача 2: Обработка необработанных сигналов каждые 5 минут
    const processSignalsTask = cron.schedule('*/5 * * * *', async () => {
      logger.info('Running scheduled signal processing');
      await this.processUnprocessedSignals();
    });
    this.tasks.push(processSignalsTask);

    // Задача 3: Очистка очередей каждые 6 часов
    const cleanQueuesTask = cron.schedule('0 */6 * * *', async () => {
      logger.info('Running scheduled queue cleanup');
      await queueManager.cleanQueues();
    });
    this.tasks.push(cleanQueuesTask);

    logger.info(`Scheduler started with ${this.tasks.length} tasks`);
  }

  /**
   * Остановить все задачи
   */
  stop() {
    logger.info('Stopping scheduler...');
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    logger.info('Scheduler stopped');
  }

  /**
   * Запланировать задачи на сбор данных для всех активных пользователей
   */
  private async scheduleFetchDataJobs() {
    try {
      // Получаем всех активных пользователей с SKU
      const users = await prisma.user.findMany({
        where: {
          wbApiKey: { not: null },
          skus: {
            some: { active: true }
          }
        },
        select: { id: true }
      });

      logger.info(`Scheduling fetch data jobs for ${users.length} users`);

      // Добавляем задачу для каждого пользователя
      for (const user of users) {
        await queueManager.addFetchDataJob({
          userId: user.id
        });
      }

      logger.info(`Scheduled ${users.length} fetch data jobs`);

    } catch (error: any) {
      logger.error('Failed to schedule fetch data jobs', {
        error: error.message
      });
    }
  }

  /**
   * Обработать необработанные сигналы
   */
  private async processUnprocessedSignals() {
    try {
      const { SignalProcessor } = await import('@/core/signal-processor/SignalProcessor');
      
      // Получаем необработанные сигналы
      const signals = await SignalProcessor.getUnprocessedSignals(50);

      if (signals.length === 0) {
        logger.debug('No unprocessed signals found');
        return;
      }

      logger.info(`Processing ${signals.length} unprocessed signals`);

      const processor = new SignalProcessor();

      // Обрабатываем каждый сигнал
      for (const signal of signals) {
        try {
          await processor.processSignal(signal);
        } catch (error: any) {
          logger.error(`Failed to process signal ${signal.id}`, {
            error: error.message
          });
          // Продолжаем обработку остальных
        }
      }

      logger.info(`Processed ${signals.length} signals`);

    } catch (error: any) {
      logger.error('Failed to process unprocessed signals', {
        error: error.message
      });
    }
  }
}

// Singleton instance
let schedulerInstance: Scheduler | null = null;

export function getScheduler(): Scheduler {
  if (!schedulerInstance) {
    schedulerInstance = new Scheduler();
  }
  return schedulerInstance;
}

export default getScheduler();
