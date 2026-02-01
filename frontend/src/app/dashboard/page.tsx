'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../lib/store';
import { api } from '../../lib/api';
import DashboardLayout from '../../components/layout/DashboardLayout';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadOverview();
    }
  }, [isAuthenticated]);

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

  if (isLoading || loading) {
    return <DashboardLayout><div className="p-8 text-gray-500">Загрузка...</div></DashboardLayout>;
  }

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <MetricCard icon="📦" label="Всего SKU" value={overview?.totalSkus ?? 0} color="blue" />
          <MetricCard icon="🎯" label="Активных SKU" value={overview?.activeSkus ?? 0} color="green" />
          <MetricCard icon="⚡" label="Стратегий" value={overview?.activeStrategies ?? 0} color="purple" />
          <MetricCard icon="⚠️" label="Safe Mode" value={overview?.safeModeSKUs ?? 0} color="yellow" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Сегодня</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center space-x-2">
                  <span>✅</span><span>Цена изменена</span>
                </span>
                <span className="font-bold text-green-600">{overview?.today?.priceChanges ?? 0} раз</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center space-x-2">
                  <span>🚫</span><span>Изменение запрещено</span>
                </span>
                <span className="font-bold text-red-500">{overview?.today?.rejections ?? 0} раз</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Быстрые действия</h2>
            <div className="space-y-2">
              <button onClick={() => router.push('/skus')} className="w-full text-left p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition flex items-center space-x-3">
                <span>📦</span><span className="text-blue-700 font-medium">Добавить SKU</span>
              </button>
              <button onClick={() => router.push('/strategies')} className="w-full text-left p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition flex items-center space-x-3">
                <span>⚡</span><span className="text-purple-700 font-medium">Создать стратегию</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  };

  return (
    <div className={`${colors[color]} border rounded-lg p-5`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-3xl font-bold">{value}</span>
      </div>
      <div className="text-sm font-medium opacity-80">{label}</div>
    </div>
  );
}
