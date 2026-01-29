import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Logger } from '@/utils/logger';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

export interface FetchDataJobPayload {
  userId: string;
  skuIds?: string[];
}

export interface RepriceJobPayload {
  skuId: string;
  signalId?: string;
  strategyId: string;
  force?: boolean;
}

export class QueueManager {
  private static instance: QueueManager;
  private logger: Logger;

  // Очереди
  public fetchDataQueue: Queue<FetchDataJobPayload>;
  public repriceQueue: Queue<RepriceJobPayload>;

  private constructor() {
    this.logger = new Logger('QueueManager');

    // Создаём очереди
    this.fetchDataQueue = new Queue<FetchDataJobPayload>('fetch-data', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: {
          age: 24 * 3600, // 24 часа
          count: 1000
        },
        removeOnFail: {
          age: 7 * 24 * 3600 // 7 дней
        }
      }
    });

    this.repriceQueue = new Queue<RepriceJobPayload>('reprice', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: {
          age: 24 * 3600,
          count: 1000
        },
        removeOnFail: {
          age: 7 * 24 * 3600
        }
      }
    });

    this.logger.info('QueueManager initialized');
  }

  /**
   * Singleton pattern
   */
  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * Добавить задачу на сбор данных
   */
  async addFetchDataJob(
    payload: FetchDataJobPayload,
    options?: any
  ): Promise<Job<FetchDataJobPayload>> {
    this.logger.info('Adding fetch data job', payload);

    return this.fetchDataQueue.add('fetch-data', payload, {
      ...options,
      jobId: `fetch-${payload.userId}-${Date.now()}`
    });
  }

  /**
   * Добавить задачу на репрайсинг
   */
  async addRepriceJob(
    payload: RepriceJobPayload,
    options?: any
  ): Promise<Job<RepriceJobPayload>> {
    this.logger.info('Adding reprice job', payload);

    return this.repriceQueue.add('reprice', payload, {
      ...options,
      priority: options?.priority || 5,
      jobId: `reprice-${payload.skuId}-${Date.now()}`
    });
  }

  /**
   * Получить статистику очередей
   */
  async getQueueStats() {
    const [
      fetchDataCounts,
      repriceCounts
    ] = await Promise.all([
      this.fetchDataQueue.getJobCounts('wait', 'active', 'completed', 'failed'),
      this.repriceQueue.getJobCounts('wait', 'active', 'completed', 'failed')
    ]);

    return {
      fetchData: fetchDataCounts,
      reprice: repriceCounts
    };
  }

  /**
   * Очистить завершённые задачи
   */
  async cleanQueues() {
    this.logger.info('Cleaning queues...');

    await Promise.all([
      this.fetchDataQueue.clean(24 * 3600 * 1000, 1000, 'completed'),
      this.fetchDataQueue.clean(7 * 24 * 3600 * 1000, 1000, 'failed'),
      this.repriceQueue.clean(24 * 3600 * 1000, 1000, 'completed'),
      this.repriceQueue.clean(7 * 24 * 3600 * 1000, 1000, 'failed')
    ]);

    this.logger.info('Queues cleaned');
  }

  /**
   * Закрыть соединения
   */
  async close() {
    await Promise.all([
      this.fetchDataQueue.close(),
      this.repriceQueue.close()
    ]);
    await connection.quit();
    this.logger.info('QueueManager closed');
  }
}

export default QueueManager.getInstance();
