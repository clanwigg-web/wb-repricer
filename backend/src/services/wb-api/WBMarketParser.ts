import axios from 'axios';
import { Logger } from '@/utils/logger';

export interface CompetitorPrice {
  nmId: number;
  price: number;       // цена до скидки
  priceWithDiscount: number; // цена со скидкой (та что видна покупателю)
  discount: number;    // скидка в процентах
  inStock: boolean;
}

export interface MarketPriceData {
  competitors: CompetitorPrice[];
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  competitorCount: number;
}

const logger = new Logger('WBMarketParser');

// User-agents для ротации
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Парсит публичную выдачу Wildberries для получения цен конкурентов.
 *
 * WB раздаёт данные товаров через внутренние JSON-эндпоинты:
 *   GET https://basket-{N}.app.wildberries.ru/vol{VOL}/part{PART}/{nmID}/info/ru-ru.json
 *   GET https://basket-{N}.app.wildberries.ru/vol{VOL}/part{PART}/{nmID}/sizes.json
 *
 * А список конкурентов в категории — через поисковой эндпоинт:
 *   POST https://search-api.wildberries.ru/webapi/v2/search/items/
 *
 * Для простоты и надёжности парсим через catalog API (публичный, без авторизации):
 *   GET https://card-api.wildberries.ru/v1/cards/similar?nm={nmID}
 *
 * Если catalog API не даёт цен — парсим через search.
 */
export class WBMarketParser {

  /**
   * Получить цены конкурентов для товара по nmID
   */
  async getCompetitorPrices(nmId: number): Promise<MarketPriceData | null> {
    try {
      logger.debug(`Fetching competitor prices for nmID ${nmId}`);

      // Шаг 1: Получаем данные о самом товаре (чтобы знать категорию/предметID)
      const cardInfo = await this.fetchCardInfo(nmId);
      if (!cardInfo) {
        logger.warn(`Could not fetch card info for nmID ${nmId}`);
        return null;
      }

      // Шаг 2: Получаем похожие товары (конкурентов) через search
      const competitors = await this.fetchSimilarProducts(nmId, cardInfo.subjectID);
      if (!competitors || competitors.length === 0) {
        logger.warn(`No competitors found for nmID ${nmId}`);
        return null;
      }

      // Шаг 3: Считаем статистику
      return this.calculateStats(competitors, nmId);

    } catch (error: any) {
      logger.error(`Failed to fetch competitor prices for nmID ${nmId}`, {
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  /**
   * Получить базовую информацию о товаре через card info API
   * Возвращает subjectID (категория товара) для последующего поиска
   */
  private async fetchCardInfo(nmId: number): Promise<{ subjectID: number } | null> {
    try {
      // WB раздаёт info через basket CDN
      // vol и part вычисляются из nmId
      const vol = Math.floor(nmId / 100000);
      const part = Math.floor(nmId / 1000);

      // Пробуем несколько basket-серверов (WB использует basket-01..basket-16)
      for (let basket = 1; basket <= 4; basket++) {
        try {
          const basketNum = String(basket).padStart(2, '0');
          const url = `https://basket-${basketNum}.app.wildberries.ru/vol${vol}/part${part}/${nmId}/info/ru-ru.json`;

          const response = await axios.get(url, {
            headers: {
              'User-Agent': randomUA(),
              'Referer': `https://www.wildberries.ru/catalog/${nmId}/item`,
            },
            timeout: 8000,
          });

          if (response.data && response.data.subjectID) {
            return { subjectID: response.data.subjectID };
          }
        } catch {
          // Пробуем следующий basket
          continue;
        }
      }

      return null;
    } catch (error: any) {
      logger.error(`fetchCardInfo failed for ${nmId}`, { error: error.message });
      return null;
    }
  }

  /**
   * Получить похожие товары (конкурентов) через search API
   * Парсим выдачу по категории товара
   */
  private async fetchSimilarProducts(
    nmId: number,
    subjectID: number
  ): Promise<CompetitorPrice[] | null> {
    try {
      // Задержка перед запросом (имитация человека)
      await sleep(300 + Math.random() * 500);

      const url = 'https://search-api.wildberries.ru/webapi/v2/search/items/';
      const response = await axios.post(url, {
        // Параметры запроса к search API
      }, {
        params: {
          appType: 1,
          curr: 'rub',
          dest: '-1,12,-1,-1',
          locale: 'ru_RU',
          nm: subjectID, // номер предмета (категория)
          page: 1,
          limit: 50,
          sort: 'popular',
          spp: 30,  // СПП
          suppressMarketplaceErrors: true,
        },
        headers: {
          'User-Agent': randomUA(),
          'Content-Type': 'application/json',
          'Referer': 'https://www.wildberries.ru/',
        },
        timeout: 10000,
      });

      if (!response.data?.data?.products) {
        return null;
      }

      const products = response.data.data.products;
      const competitors: CompetitorPrice[] = [];

      for (const product of products) {
        // Пропускаем сам товар
        if (product.id === nmId) continue;

        // Берём цену из sizes[0] — первый доступный размер
        const size = product.sizes?.[0];
        if (!size) continue;

        const price = size.price?.price ?? product.priceWithDiscount ?? 0;
        const priceWithDiscount = size.price?.priceWithDiscount ?? price;
        const discount = size.price?.discount ?? 0;
        const inStock = (size.remains ?? 0) > 0;

        if (price > 0) {
          competitors.push({
            nmId: product.id,
            price,
            priceWithDiscount,
            discount,
            inStock,
          });
        }
      }

      return competitors;

    } catch (error: any) {
      logger.error(`fetchSimilarProducts failed`, { error: error.message });
      return null;
    }
  }

  /**
   * Рассчитать статистику по ценам конкурентов
   * Работаем только с товарами в наличии
   */
  private calculateStats(
    allCompetitors: CompetitorPrice[],
    ownNmId: number
  ): MarketPriceData {
    // Берём только товары в наличии для расчёта статистики
    const inStock = allCompetitors.filter((c) => c.inStock);
    const prices = (inStock.length > 0 ? inStock : allCompetitors)
      .map((c) => c.priceWithDiscount)
      .sort((a, b) => a - b);

    const minPrice = prices[0] ?? 0;
    const maxPrice = prices[prices.length - 1] ?? 0;
    const medianPrice = this.median(prices);

    return {
      competitors: allCompetitors,
      minPrice,
      maxPrice,
      medianPrice,
      competitorCount: allCompetitors.length,
    };
  }

  private median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 === 0
      ? (arr[mid - 1] + arr[mid]) / 2
      : arr[mid];
  }
}
