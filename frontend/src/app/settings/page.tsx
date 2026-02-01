'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../lib/store';
import { api } from '../../lib/api';
import DashboardLayout from '../../components/layout/DashboardLayout';

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const [wbApiKey, setWbApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) fetchProfile();
  }, [isAuthenticated]);

  const fetchProfile = async () => {
    try {
      const data = await api.me();
      setWbApiKey(data.user.wbApiKey || '');
    } catch (e) {
      console.error('Failed to fetch profile', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await api.updateProfile({ wbApiKey });
      setStatus({ type: 'success', message: 'Токен сохранён успешно' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.response?.data?.message || 'Ошибка сохранения' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await api.updateProfile({ wbApiKey: '' });
      setWbApiKey('');
      setStatus({ type: 'success', message: 'Токен удалён' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.response?.data?.message || 'Ошибка' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return <DashboardLayout><div className="p-8 text-gray-500">Загрузка...</div></DashboardLayout>;
  }
  if (!isAuthenticated) return null;

  const maskKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 8) return '•'.repeat(key.length);
    return key.slice(0, 4) + '•'.repeat(key.length - 8) + key.slice(-4);
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Настройки</h1>

        {/* WB API Key */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-gray-800">Токен Wildberries API</h2>
            {wbApiKey ? (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Установлен</span>
            ) : (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">⚠ Не установлен</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Токен из личного кабинета Wildberries необходим для автоматического изменения цен товаров.
            Найти его можно в ЛК → Настройки → API.
          </p>

          {status && (
            <div className={`text-sm p-3 rounded-lg mb-4 ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {status.message}
            </div>
          )}

          <div className="space-y-3">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={wbApiKey}
                onChange={(e) => { setWbApiKey(e.target.value); setStatus(null); }}
                placeholder="Вставьте токен WB API сюда"
                className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium"
              >
                {showKey ? 'Скрыть' : 'Показать'}
              </button>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleSave}
                disabled={saving || !wbApiKey}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium text-sm"
              >
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </button>
              {wbApiKey && (
                <button
                  onClick={handleClear}
                  disabled={saving}
                  className="bg-gray-100 text-gray-600 px-5 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition font-medium text-sm"
                >
                  Очистить
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">ℹ️ Как получить токен</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Войдите в личный кабинет Wildberries (suppliers.wildberries.ru)</li>
            <li>Перейдите в Настройки → Доступ по API</li>
            <li>Скопируйте токен с доступом к «Ценам и скидкам»</li>
            <li>Вставьте его в поле выше и нажмите «Сохранить»</li>
          </ol>
        </div>
      </div>
    </DashboardLayout>
  );
}
