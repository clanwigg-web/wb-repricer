import { SignalType } from '../types/signal.types';

// ============================================================================
// SIGNAL PRIORITIES
// ============================================================================
export const SIGNAL_PRIORITIES: Record<SignalType, number> = {
  [SignalType.COMPETITOR_OOS]: 10,
  [SignalType.LOW_STOCK]: 9,
  [SignalType.BELOW_BREAKEVEN]: 9,
  [SignalType.COMPETITOR_PRICE_DROP]: 8,
  [SignalType.POSITION_DROP]: 7,
  [SignalType.COST_CHANGE]: 7,
  [SignalType.SALES_DROP]: 6,
  [SignalType.MARGIN_DROP]: 6,
  [SignalType.COMPETITOR_PRICE_RISE]: 5,
  [SignalType.POSITION_RISE]: 5,
  [SignalType.SALES_SPIKE]: 4,
  [SignalType.NEW_COMPETITOR]: 4,
  [SignalType.COMPETITOR_COUNT_CHANGE]: 3,
  [SignalType.HIGH_STOCK]: 3,
  [SignalType.TIME_INTERVAL]: 1,
  [SignalType.STRATEGY_TIMEOUT]: 1,
};

// ============================================================================
// DEFAULT VALUES
// ============================================================================
export const DEFAULT_COOLDOWN_MINUTES = 360; // 6 часов
export const DEFAULT_MAX_CHANGES_PER_DAY = 3;
export const MIN_PRICE_CHANGE_THRESHOLD = 0.01; // 1%
export const WB_API_RATE_LIMIT_MS = 2000; // 2 секунды

// ============================================================================
// STRATEGY DEFAULTS
// ============================================================================
export const DEFAULT_MIN_PROFIT = 100; // 100 рублей
export const DEFAULT_MIN_MARGIN = 10; // 10%
