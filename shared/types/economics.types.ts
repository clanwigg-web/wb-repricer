// ============================================================================
// ECONOMICS TYPES
// ============================================================================

export interface UnitEconomics {
  costPrice: number;
  wbCommission: number;
  logistics: number;
  storage: number;
  spp: number;
  tax: number;
  currency: 'RUB' | 'USD' | 'EUR';
}

export interface PriceProposal {
  price: number;
  reason: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface PriceValidationError {
  type: 
    | 'min_profit_violated'
    | 'min_margin_violated'
    | 'below_breakeven'
    | 'max_price_exceeded'
    | 'min_price_violated'
    | 'delta_too_large';
  message: string;
  critical: boolean;
  suggestedPrice?: number;
}

export interface PriceValidationResult {
  valid: boolean;
  errors: PriceValidationError[];
  warnings?: string[];
  
  profit: number;
  margin: number;
  breakeven: number;
  
  suggestedPrice?: number;
  minAllowedPrice?: number;
  maxAllowedPrice?: number;
}

export interface PriceChangeResult {
  success: boolean;
  newPrice?: number;
  oldPrice: number;
  reason?: string;
  error?: string;
  validationErrors?: PriceValidationError[];
  timestamp: Date;
}
