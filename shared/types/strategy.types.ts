// ============================================================================
// STRATEGY TYPES
// ============================================================================

export enum StrategyType {
  COMPETITIVE_HOLD = 'competitive_hold',
  PRICE_LEADER = 'price_leader',
  MARGIN_MAXIMIZER = 'margin_maximizer',
  INVENTORY_DRIVEN = 'inventory_driven',
  CLEARANCE = 'clearance'
}

export enum ConditionOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'not_in'
}

export enum ActionType {
  SET_PRICE = 'set_price',
  INCREASE_PRICE = 'increase_price',
  DECREASE_PRICE = 'decrease_price',
  FOLLOW_COMPETITOR = 'follow_competitor',
  SET_TO_MEDIAN = 'set_to_median',
  SET_TO_BREAKEVEN = 'set_to_breakeven'
}

export enum ConstraintType {
  MIN_PRICE = 'min_price',
  MAX_PRICE = 'max_price',
  MIN_PROFIT = 'min_profit',
  MIN_MARGIN = 'min_margin',
  MAX_DELTA_PER_STEP = 'max_delta_per_step',
  MAX_CHANGES_PER_DAY = 'max_changes_per_day'
}

export interface Condition {
  id: string;
  metric: string; // 'position', 'competitor_price', 'sales_velocity', etc.
  operator: ConditionOperator;
  value: number | string | number[];
  and?: Condition[];
  or?: Condition[];
}

export interface Action {
  id: string;
  type: ActionType;
  value?: number;
  mode?: 'percentage' | 'absolute';
  target?: string;
}

export interface Constraint {
  id: string;
  type: ConstraintType;
  value: number;
  enabled: boolean;
}

export interface StopCondition {
  id: string;
  type: 'price_reached' | 'time_elapsed' | 'position_reached' | 'stock_level';
  value: number;
  met?: boolean;
}

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  type: StrategyType;
  active: boolean;
  
  conditions: Condition[];
  actions: Action[];
  constraints: Constraint[];
  stopConditions: StopCondition[];
  
  allowedSignals: string[];
  ignoredSignals: string[];
  
  cooldownMinutes: number;
  maxChangesPerDay: number;
  
  createdAt: Date;
  updatedAt: Date;
}
