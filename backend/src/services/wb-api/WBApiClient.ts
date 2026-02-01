import axios, { AxiosInstance } from 'axios';
import { Logger } from '@/utils/logger';

export interface WBProduct {
  nmId: number;
  vendorCode: string;
  title: string;
  price: number;
  discount: number;
  priceWithDiscount: number;
  rating: number;
  feedbacks: number;
  inStock: boolean;
}

export interface WBPriceUpdate {
  nmId: number;
  price: number;
}

export interface WBPriceUpdateResult {
  success: boolean;
  nmId: number;
  error?: string;
}

export class WBApiClient {
  private client: AxiosInstance;
  private logger: Logger;
  private lastRequestTime: number = 0;
  private rateLimitMs: number;

  constructor(private apiKey: string) {
    this.logger = new Logger('WBApiClient');
    this.rateLimitMs = Number(process.env.WB_API_RATE_LIMIT_MS) || 2000;

    this.client = axios.create({
      baseURL: process.env.WB_API_BASE_URL || 'https://suppliers-api.wildberries.ru',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Response interceptor для логирования
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('WB API response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error('WB API error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        throw error;
      }
    );
  }

  /**
   * Rate limiting - ждём перед запросом
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitMs) {
      const waitTime = this.rateLimitMs - timeSinceLastRequest;
      this.logger.debug(`Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Получить информацию о товаре
   */
  async getProduct(nmId: number): Promise<WBProduct | null> {
    try {
      await this.waitForRateLimit();

      this.logger.info(`Fetching product ${nmId}`);

      // Реальный endpoint WB API (пример, может отличаться)
      const response = await this.client.get(`/content/v1/cards/filter`, {
        params: {
          locale: 'ru',
          limit: 1
        },
        data: {
          nmID: [nmId]
        }
      });

      if (!response.data || !response.data.data || response.data.data.length === 0) {
        return null;
      }

      const card = response.data.data[0];

      return {
        nmId: card.nmID,
        vendorCode: card.vendorCode,
        title: card.object,
        price: card.sizes[0]?.price || 0,
        discount: card.discount || 0,
        priceWithDiscount: card.sizes[0]?.priceWithDiscount || 0,
        rating: card.rating || 0,
        feedbacks: card.feedbackCount || 0,
        inStock: card.sizes[0]?.quantity > 0
      };

    } catch (error: any) {
      this.logger.error(`Failed to fetch product ${nmId}`, {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Получить список карточек товаров через Content API v2
   * POST https://content-api.wildberries.ru/content/v2/get/cards/list
   * Параметр textSearch — поиск по nmID или названию
   */
  async getCardsList(textSearch?: string, limit: number = 100): Promise<WBProduct[]> {
    try {
      await this.waitForRateLimit();

      this.logger.info(`Fetching cards list (search: "${textSearch}", limit: ${limit})`);

      const contentClient = axios.create({
        baseURL: 'https://content-api.wildberries.ru',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const body: any = {
        settings: {
          sort: { ascending: false },
          cursor: { limit },
          filter: { withPhoto: -1 }
        }
      };

      if (textSearch) {
        body.settings.filter.textSearch = textSearch;
      }

      const response = await contentClient.post('/content/v2/get/cards/list?locale=ru', body);

      if (!response.data || !response.data.cards) {
        return [];
      }

      return response.data.cards.map((card: any) => ({
        nmId: card.nmID,
        vendorCode: card.vendorCode || '',
        title: card.title || card.brand || '',
        price: 0,
        discount: 0,
        priceWithDiscount: 0,
        rating: 0,
        feedbacks: 0,
        inStock: false
      }));

    } catch (error: any) {
      this.logger.error('Failed to fetch cards list', {
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data
      });
      return [];
    }
  }

  /**
   * Установить цену товара
   * Реальный endpoint: POST https://discounts-prices-api.wildberries.ru/api/v2/upload/task
   * Тело: { data: [{ nmID, price, discount }] }
   * Если новая цена со скидкой будет хотя бы в 3 раза меньше старой — товар попадёт в карантин.
   */
  async setPrice(nmId: number, price: number, discount: number = 0): Promise<WBPriceUpdateResult> {
    try {
      await this.waitForRateLimit();

      this.logger.info(`Setting price for nmID ${nmId}: price=${price}₽, discount=${discount}%`);

      // Отдельный клиент для pricing API (другой baseURL)
      const pricingClient = axios.create({
        baseURL: 'https://discounts-prices-api.wildberries.ru',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const response = await pricingClient.post('/api/v2/upload/task', {
        data: [
          {
            nmID: nmId,
            price: price,
            discount: discount
          }
        ]
      });

      if (response.data?.error) {
        this.logger.error(`WB API returned error for nmID ${nmId}`, {
          errorText: response.data.errorText
        });
        return {
          success: false,
          nmId,
          error: response.data.errorText || 'Unknown error from WB API'
        };
      }

      this.logger.info(`Price set successfully for nmID ${nmId}, task id: ${response.data?.data?.id}`);

      return {
        success: true,
        nmId
      };

    } catch (error: any) {
      this.logger.error(`Failed to set price for nmID ${nmId}`, {
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        price,
        discount
      });

      return {
        success: false,
        nmId,
        error: error.response?.data?.errorText || error.message
      };
    }
  }

  /**
   * Массовое обновление цен
   */
  async setPrices(updates: WBPriceUpdate[]): Promise<WBPriceUpdateResult[]> {
    const results: WBPriceUpdateResult[] = [];

    // Обрабатываем по одному с rate limiting
    for (const update of updates) {
      const result = await this.setPrice(update.nmId, update.price);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.info(`Batch price update completed: ${successCount}/${updates.length} successful`);

    return results;
  }

  /**
   * Получить цену товара из выдачи (для мониторинга конкурентов)
   * ВНИМАНИЕ: Это упрощенная версия. Реальный скрейпинг WB требует более сложной логики
   */
  async getMarketPrice(nmId: number): Promise<number | null> {
    try {
      await this.waitForRateLimit();

      // В реальности здесь был бы запрос к публичной выдаче WB
      // Или использование специального API для аналитики
      
      this.logger.debug(`Fetching market price for ${nmId}`);

      // TODO: Реализовать получение цены из выдачи
      // Возможные варианты:
      // 1. Парсинг публичной страницы товара
      // 2. Использование WB Analytics API (если есть доступ)
      // 3. Интеграция с сервисами типа MPStats

      return null;

    } catch (error: any) {
      this.logger.error(`Failed to fetch market price for ${nmId}`, {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Получить позицию товара в выдаче по запросу
   */
  async getProductPosition(nmId: number, query: string): Promise<number | null> {
    try {
      await this.waitForRateLimit();

      this.logger.debug(`Fetching position for ${nmId} by query "${query}"`);

      // TODO: Реализовать получение позиции
      // В реальности это требует:
      // 1. Запрос к поиску WB
      // 2. Парсинг результатов
      // 3. Поиск nmId в результатах

      return null;

    } catch (error: any) {
      this.logger.error(`Failed to fetch position for ${nmId}`, {
        error: error.message
      });
      return null;
    }
  }
}
