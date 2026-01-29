'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';

export default function DashboardPage() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      const data = await api.getOverview();
      setOverview(data.overview);
    } catch (error) {
      console.error('Failed to load overview', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Загрузка...</div>;
  }

  if (!overview) {
    return <div className="p-8">Нет данных</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon="🎯"
          label="SKU под управлением"
          value={overview.activeSkus}
          color="blue"
        />
        <MetricCard
          icon="⚡"
          label="Активных стратегий"
          value={overview.activeStrategies}
          color="green"
        />
        <MetricCard
          icon="⚠️"
          label="Safe Mode"
          value={overview.safeModeSKUs}
          color="yellow"
        />
        <MetricCard
          icon="📊"
          label="Всего SKU"
          value={overview.totalSkus}
          color="gray"
        />
      </div>

      {/* Today Stats */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Сегодня</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">✅ Цена изменена</span>
            <span className="font-semibold">{overview.today.priceChanges} раз</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">🚫 Изменение запрещено</span>
            <span className="font-semibold">{overview.today.rejections} раза</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Быстрые действия</h2>
        <div className="space-y-2">
          <a href="/skus" className="block p-3 bg-blue-50 rounded hover:bg-blue-100 transition">
            📦 Управление SKU
          </a>
          <a href="/strategies" className="block p-3 bg-green-50 rounded hover:bg-green-100 transition">
            ⚡ Управление стратегиями
          </a>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: any) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    gray: 'bg-gray-50 text-gray-600'
  };

  return (
    <div className={`${colors[color]} rounded-lg p-6`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-sm font-medium mb-1">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}
