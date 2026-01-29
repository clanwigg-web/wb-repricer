import { UnitEconomicsEngine } from '@/core/engines/economics-engine/UnitEconomicsEngine';
import type { UnitEconomics } from '@shared/types/economics.types';
import type { Constraint } from '@shared/types/strategy.types';

describe('UnitEconomicsEngine', () => {
  let engine: UnitEconomicsEngine;
  let economics: UnitEconomics;

  beforeEach(() => {
    engine = new UnitEconomicsEngine();
    economics = {
      costPrice: 800,
      wbCommission: 15,
      logistics: 50,
      storage: 0,
      spp: 0,
      tax: 6,
      currency: 'RUB'
    };
  });

  describe('calculateProfit', () => {
    it('should calculate profit correctly', () => {
      const price = 1200;
      const profit = engine.calculateProfit(price, economics);
      
      // 1200 * (1 - 0) = 1200 (after SPP)
      // 1200 * 0.15 = 180 (commission)
      // 1200 * 0.06 = 72 (tax)
      // 1200 - 800 - 180 - 50 - 0 - 72 = 98
      
      expect(profit).toBe(98);
    });

    it('should handle SPP discount', () => {
      economics.spp = 10; // 10% SPP
      const price = 1200;
      const profit = engine.calculateProfit(price, economics);
      
      // 1200 * 0.9 = 1080 (after SPP)
      // Should be less than without SPP
      
      expect(profit).toBeLessThan(98);
    });
  });

  describe('calculateMargin', () => {
    it('should calculate margin correctly', () => {
      const price = 1200;
      const margin = engine.calculateMargin(price, economics);
      
      // profit = 98, price = 1200
      // margin = (98 / 1200) * 100 = 8.17%
      
      expect(margin).toBeCloseTo(8.17, 1);
    });
  });

  describe('calculateBreakeven', () => {
    it('should calculate breakeven price', () => {
      const breakeven = engine.calculateBreakeven(economics);
      
      // fixedCosts = 800 + 50 + 0 = 850
      // variableCostRate = (15 + 0 + 6) / 100 = 0.21
      // breakeven = 850 / (1 - 0.21) = 850 / 0.79 = 1076
      
      expect(breakeven).toBe(1076);
    });
  });

  describe('validatePrice', () => {
    it('should pass validation for valid price', () => {
      const constraints: Constraint[] = [
        { id: '1', type: 'min_profit', value: 100, enabled: true },
        { id: '2', type: 'min_margin', value: 10, enabled: true }
      ];

      const result = engine.validatePrice(1500, economics, constraints);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation if profit too low', () => {
      const constraints: Constraint[] = [
        { id: '1', type: 'min_profit', value: 200, enabled: true }
      ];

      const result = engine.validatePrice(1200, economics, constraints);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('min_profit_violated');
    });

    it('should fail validation if below breakeven', () => {
      const constraints: Constraint[] = [];
      const breakeven = engine.calculateBreakeven(economics);
      
      const result = engine.validatePrice(breakeven - 100, economics, constraints);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'below_breakeven')).toBe(true);
    });

    it('should provide suggested price on failure', () => {
      const constraints: Constraint[] = [
        { id: '1', type: 'min_profit', value: 200, enabled: true }
      ];

      const result = engine.validatePrice(1000, economics, constraints);
      
      expect(result.suggestedPrice).toBeDefined();
      expect(result.suggestedPrice!).toBeGreaterThan(1000);
    });
  });
});
