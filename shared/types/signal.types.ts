// ============================================================================
// SIGNAL TYPES
// ============================================================================

export enum SignalType {
  // Market signals
  COMPETITOR_PRICE_DROP = 'competitor_price_drop',
  COMPETITOR_PRICE_RISE = 'competitor_price_rise',
  COMPETITOR_OOS = 'competitor_oos',
  NEW_COMPETITOR = 'new_competitor',
  COMPETITOR_COUNT_CHANGE = 'competitor_count_change',
  
  // Internal signals
  POSITION_DROP = 'position_drop',
  POSITION_RISE = 'position_rise',
  SALES_DROP = 'sales_drop',
  SALES_SPIKE = 'sales_spike',
  LOW_STOCK = 'low_stock',
  HIGH_STOCK = 'high_stock',
  MARGIN_DROP = 'margin_drop',
  
  // Time-based
  TIME_INTERVAL = 'time_interval',
  STRATEGY_TIMEOUT = 'strategy_timeout',
  
  // Economics
  BELOW_BREAKEVEN = 'below_breakeven',
  COST_CHANGE = 'cost_change'
}

export interface Signal {
  id: string;
  type: SignalType;
  skuId: string;
  timestamp: Date;
  priority: number;
  data: Record<string, any>;
  processed: boolean;
}

export interface SignalData {
  oldPrice?: number;
  newPrice?: number;
  competitorId?: string;
  priceChange?: number;
  priceChangePercent?: number;
  
  oldPosition?: number;
  newPosition?: number;
  salesVelocity?: number;
  stockLevel?: number;
  daysOfStock?: number;
  
  currentMargin?: number;
  currentProfit?: number;
}
