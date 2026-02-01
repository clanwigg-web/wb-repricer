'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../lib/store';
import { api } from '../../lib/api';
import DashboardLayout from '../../components/layout/DashboardLayout';

interface SKU {
  id: string;
  wbSkuId: string;
  name: string | null;
  currentPrice: number | null;
  costPrice: number;
  wbCommission: number;
  logistics: number;
  active: boolean;
  skuStrategies?: { strategy: { name: string; type: string } }[];
}

export default function SKUsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const [skus, setSkus] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) fetchSKUs();
  }, [isAuthenticated]);

  const fetchSKUs = async () => {
    try {
      const data = await api.getSKUs();
      setSkus(data.skus);
    } catch (e) {
      console.error('Failed to fetch SKUs', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSKU(id);
      setSkus((prev) => prev.filter((s) => s.id !== id));
      setDeleteId(null);
    } catch (e) {
      console.error('Failed to delete SKU', e);
    }
  };

  if (isLoading || loading) {
    return <DashboardLayout><div className="p-8 text-gray-500">Загрузка...</div></DashboardLayout>;
  }
  if (!isAuthenticated) return null;

  const activeStrategy = (sku: SKU) => sku.skuStrategies?.find((s: any) => s.active);

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">SKU</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + Добавить SKU
          </button>
        </div>

        {skus.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Нет товаров</h2>
            <p className="text-gray-500 mb-4">Добавьте первый товар для начала работы с репрайсером</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Добавить SKU
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">WB SKU ID</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Название</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Себестоимость</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Текущая цена</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Стратегия</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody>
                {skus.map((sku) => {
                  const strat = activeStrategy(sku);
                  return (
                    <tr key={sku.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">{sku.wbSkuId}</td>
                      <td className="px-6 py-4 text-sm text-gray-800 font-medium">{sku.name || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{sku.costPrice} ₽</td>
                      <td className="px-6 py-4 text-sm text-gray-800 font-semibold text-right">
                        {sku.currentPrice != null ? `${sku.currentPrice} ₽` : '—'}
                      </td>
                      <td className="px-6 py-4">
                        {strat ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                            {strat.strategy.name}
                          </span>
                        ) : (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                            Safe Mode
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => router.push(`/strategies?skuId=${sku.id}`)}
                          className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded hover:bg-purple-200 transition"
                        >
                          Стратегия
                        </button>
                        <button
                          onClick={() => setDeleteId(sku.id)}
                          className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 transition"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add SKU Modal */}
      {showModal && (
        <SKUModal onClose={() => setShowModal(false)} onSave={(sku) => { setSkus((prev) => [sku, ...prev]); setShowModal(false); }} />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Удалить SKU?</h3>
            <p className="text-gray-500 text-sm mb-6">Это действие нельзя отменить. Все связанные стратегии тоже удалятся.</p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Отмена</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition">Удалить</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}


function SKUModal({ onClose, onSave }: { onClose: () => void; onSave: (sku: SKU) => void }) {
  const [form, setForm] = useState({
    wbSkuId: '',
    name: '',
    costPrice: '',
    currentPrice: '',
    wbCommission: '15',
    logistics: '50',
    storage: '0',
    spp: '0',
    tax: '6',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Автокомплит
  const [wbCards, setWbCards] = useState<{ nmId: number; title: string; vendorCode: string }[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [cardsError, setCardsError] = useState('');

  const loadWBCards = async () => {
    if (cardsLoaded) { setShowDropdown(true); return; }
    setCardsLoading(true);
    setCardsError('');
    try {
      const data = await api.getWBCards();
      setWbCards(data.cards || []);
      setCardsLoaded(true);
    } catch (err: any) {
      setCardsError(err.response?.data?.message || 'Не удалось загрузить товары');
    } finally {
      setCardsLoading(false);
      setShowDropdown(true);
    }
  };

  const filtered = form.wbSkuId
    ? wbCards.filter((c) =>
        String(c.nmId).includes(form.wbSkuId) ||
        c.title.toLowerCase().includes(form.wbSkuId.toLowerCase()) ||
        c.vendorCode.toLowerCase().includes(form.wbSkuId.toLowerCase())
      )
    : wbCards;

  const selectCard = (card: { nmId: number; title: string }) => {
    setForm((prev) => ({ ...prev, wbSkuId: String(card.nmId), name: card.title }));
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload: any = {
        wbSkuId: form.wbSkuId,
        costPrice: Number(form.costPrice),
        wbCommission: Number(form.wbCommission),
        logistics: Number(form.logistics),
        storage: Number(form.storage),
        spp: Number(form.spp),
        tax: Number(form.tax),
      };
      if (form.name) payload.name = form.name;
      if (form.currentPrice) payload.currentPrice = Number(form.currentPrice);

      const data = await api.createSKU(payload);
      onSave(data.sku);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка создания SKU');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, name, placeholder, type = 'text', suffix }: any) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={(form as any)[name]}
          onChange={(e) => setForm((prev) => ({ ...prev, [name]: e.target.value }))}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Добавить SKU</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

          {/* WB SKU ID с автокомплитом */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WB SKU ID (nmID) *
              {cardsLoaded && <span className="text-gray-400 font-normal ml-2">— {wbCards.length} товаров</span>}
            </label>
            <input
              type="text"
              value={form.wbSkuId}
              onFocus={loadWBCards}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, wbSkuId: e.target.value }));
                setShowDropdown(true);
              }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Введите nmID или название товара..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="off"
            />

            {showDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {cardsLoading && (
                  <div className="px-4 py-3 text-sm text-gray-500 text-center">Загрузка товаров...</div>
                )}
                {cardsError && (
                  <div className="px-4 py-3 text-sm text-red-600 bg-red-50">{cardsError}</div>
                )}
                {!cardsLoading && !cardsError && filtered.length > 0 && filtered.map((card) => (
                  <button
                    key={card.nmId}
                    type="button"
                    onMouseDown={() => selectCard(card)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition border-b last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-800 font-medium truncate mr-3">{card.title}</span>
                      <span className="text-xs font-mono text-gray-400 shrink-0">{card.nmId}</span>
                    </div>
                    {card.vendorCode && (
                      <div className="text-xs text-gray-400 mt-0.5">Артикул: {card.vendorCode}</div>
                    )}
                  </button>
                ))}
                {!cardsLoading && !cardsError && filtered.length === 0 && cardsLoaded && (
                  <div className="px-4 py-3 text-sm text-gray-500 text-center">
                    {form.wbSkuId ? 'Товаров не найдено' : 'Нет товаров'}
                  </div>
                )}
              </div>
            )}
          </div>

          <Field label="Название товара" name="name" placeholder="Электрическая фритюрница" />

          <div className="border-t pt-4 mt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Экономика товара</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Себестоимость *" name="costPrice" placeholder="800" suffix="₽" type="number" />
              <Field label="Текущая цена" name="currentPrice" placeholder="1500" suffix="₽" type="number" />
              <Field label="Комиссия WB" name="wbCommission" placeholder="15" suffix="%" type="number" />
              <Field label="Логистика" name="logistics" placeholder="50" suffix="₽" type="number" />
              <Field label="Хранение" name="storage" placeholder="0" suffix="₽" type="number" />
              <Field label="СПП" name="spp" placeholder="0" suffix="%" type="number" />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Отмена</button>
            <button type="submit" disabled={loading} className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
              {loading ? 'Создаём...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
