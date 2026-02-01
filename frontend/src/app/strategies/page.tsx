'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '../../lib/store';
import { api } from '../../lib/api';
import DashboardLayout from '../../components/layout/DashboardLayout';

// Обёртка: useSearchParams требует Suspense в Next.js 14
export default function StrategiesPageWrapper() {
  return (
    <Suspense fallback={<DashboardLayout><div className="p-8 text-gray-500">Загрузка...</div></DashboardLayout>}>
      <StrategiesPageInner />
    </Suspense>
  );
}

interface Strategy {
  id: string;
  name: string;
  type: string;
  activeSKUCount: number;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  type: string;
  goal: string;
  howItWorks: string[];
  warnings: string[];
  suitableFor: string[];
  defaultConstraints: { type: string; value: number; enabled: boolean }[];
}

interface SKU {
  id: string;
  wbSkuId: string;
  name: string | null;
}

function StrategiesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const skuIdParam = searchParams.get('skuId');

  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);

  // Модали
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [attachModal, setAttachModal] = useState<string | null>(null); // strategyId
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) fetchAll();
  }, [isAuthenticated]);

  const fetchAll = async () => {
    try {
      const [strData, tplData, skuData] = await Promise.all([
        api.getStrategies(),
        api.getStrategyTemplates(),
        api.getSKUs(),
      ]);
      setStrategies(strData.strategies);
      setTemplates(tplData.templates);
      setSkus(skuData.skus);
    } catch (e) {
      console.error('Failed to fetch', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteStrategy(id);
      setStrategies((prev) => prev.filter((s) => s.id !== id));
      setDeleteId(null);
    } catch (e) {
      console.error('Failed to delete', e);
    }
  };

  if (isLoading || loading) {
    return <DashboardLayout><div className="p-8 text-gray-500">Загрузка...</div></DashboardLayout>;
  }
  if (!isAuthenticated) return null;

  const typeLabels: Record<string, string> = {
    competitive_hold: 'Competitive Hold',
    price_leader: 'Price Leader',
    margin_maximizer: 'Margin Maximizer',
  };

  const typeColors: Record<string, string> = {
    competitive_hold: 'bg-blue-100 text-blue-700',
    price_leader: 'bg-red-100 text-red-700',
    margin_maximizer: 'bg-green-100 text-green-700',
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Стратегии</h1>
          <button
            onClick={() => setShowTemplates(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition font-medium"
          >
            + Создать стратегию
          </button>
        </div>

        {/* If came from SKU page with skuId param — highlight */}
        {skuIdParam && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start justify-between">
            <p className="text-blue-700 text-sm">
              <strong>Подсказка:</strong> Создайте или выберите стратегию и привязайте её к вашему SKU (кнопка «Привязать»).
            </p>
            <button onClick={() => router.push('/strategies')} className="text-blue-500 hover:text-blue-700 text-sm ml-4 shrink-0">×</button>
          </div>
        )}

        {strategies.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-5xl mb-4">⚡</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Нет стратегий</h2>
            <p className="text-gray-500 mb-4">Создайте стратегию из шаблона и привязайте её к товару</p>
            <button onClick={() => setShowTemplates(true)} className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition font-medium">
              Создать стратегию
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {strategies.map((strategy) => (
              <div key={strategy.id} className="bg-white rounded-lg shadow p-5 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <h3 className="font-semibold text-gray-800">{strategy.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[strategy.type] || 'bg-gray-100 text-gray-600'}`}>
                      {typeLabels[strategy.type] || strategy.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {strategy.activeSKUCount} SKU привязан{strategy.activeSKUCount === 1 ? '' : strategy.activeSKUCount >= 2 && strategy.activeSKUCount <= 4 ? 'ы' : 'о'}
                  </p>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => setAttachModal(strategy.id)}
                    className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-200 transition font-medium"
                  >
                    Привязать к SKU
                  </button>
                  <button
                    onClick={() => setDeleteId(strategy.id)}
                    className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-200 transition"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Templates Modal */}
      {showTemplates && !selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-800">Выберите шаблон стратегии</h3>
              <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl)}
                  className="w-full text-left p-4 border rounded-lg hover:border-purple-400 hover:bg-purple-50 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-gray-800">{tpl.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[tpl.type] || ''}`}>
                      {typeLabels[tpl.type] || tpl.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{tpl.description}</p>
                  <p className="text-xs text-purple-600 mt-1 font-medium">🎯 {tpl.goal}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Strategy from Template */}
      {selectedTemplate && (
        <CreateStrategyModal
          template={selectedTemplate}
          onClose={() => { setSelectedTemplate(null); setShowTemplates(false); }}
          onSave={(strategy) => {
            setStrategies((prev) => [strategy, ...prev]);
            setSelectedTemplate(null);
            setShowTemplates(false);
          }}
        />
      )}

      {/* Attach Modal */}
      {attachModal && (
        <AttachModal
          strategyId={attachModal}
          skus={skus}
          defaultSkuId={skuIdParam}
          onClose={() => setAttachModal(null)}
          onDone={() => { setAttachModal(null); fetchAll(); }}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Удалить стратегию?</h3>
            <p className="text-gray-500 text-sm mb-6">Стратегия будет удалена из всех привязанных SKU.</p>
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

function CreateStrategyModal({ template, onClose, onSave }: { template: Template; onClose: () => void; onSave: (s: Strategy) => void }) {
  const [name, setName] = useState(`${template.name} — мой товар`);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.createStrategy({
        name,
        type: template.type,
        constraints: template.defaultConstraints,
        cooldownMinutes: 360,
        maxChangesPerDay: 3,
      });
      onSave(data.strategy);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Создать: {template.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-6">
          {/* Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-5 space-y-3">
            <p className="text-sm text-gray-600"><strong>Цель:</strong> {template.goal}</p>
            <div>
              <p className="text-sm text-gray-600 font-medium mb-1">Как работает:</p>
              <ul className="text-sm text-gray-500 space-y-0.5">
                {template.howItWorks.map((h, i) => <li key={i}>• {h}</li>)}
              </ul>
            </div>
            {template.warnings.length > 0 && (
              <div className="bg-yellow-50 rounded p-2">
                {template.warnings.map((w, i) => <p key={i} className="text-sm text-yellow-700">{w}</p>)}
              </div>
            )}
            <div>
              <p className="text-sm text-gray-600 font-medium mb-1">Подходит для:</p>
              <div className="flex flex-wrap gap-1">
                {template.suitableFor.map((s, i) => (
                  <span key={i} className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium mb-1">Ограничения по умолчанию:</p>
              <div className="flex space-x-3">
                {template.defaultConstraints.map((c, i) => (
                  <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {c.type === 'min_profit' ? `Мин. прибыль: ${c.value}₽` : `Мин. маржа: ${c.value}%`}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название стратегии</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Отмена</button>
              <button type="submit" disabled={loading} className="px-6 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition font-medium">
                {loading ? 'Создаём...' : 'Создать стратегию'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function AttachModal({ strategyId, skus, defaultSkuId, onClose, onDone }: { strategyId: string; skus: SKU[]; defaultSkuId: string | null; onClose: () => void; onDone: () => void }) {
  const [selectedSku, setSelectedSku] = useState<string>(defaultSkuId || '');
  const [activate, setActivate] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSku) { setError('Выберите SKU'); return; }
    setError('');
    setLoading(true);
    try {
      if (activate) {
        await api.activateStrategy(strategyId, selectedSku);
      } else {
        await api.attachStrategy(strategyId, selectedSku);
      }
      onDone();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка привязки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Привязать к SKU</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

          {skus.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Нет SKU. Сначала добавьте товар на странице SKU.</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Выберите SKU</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {skus.map((sku) => (
                    <label key={sku.id} className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${selectedSku === sku.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="sku" checked={selectedSku === sku.id} onChange={() => setSelectedSku(sku.id)} className="mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{sku.name || sku.wbSkuId}</p>
                        <p className="text-xs text-gray-500">SKU ID: {sku.wbSkuId}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg cursor-pointer">
                <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} className="rounded" />
                <div>
                  <p className="text-sm font-medium text-green-700">Активировать немедленно</p>
                  <p className="text-xs text-green-600">Стратегия начнёт управлять ценой этого SKU</p>
                </div>
              </label>

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Отмена</button>
                <button type="submit" disabled={loading || !selectedSku} className="px-6 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition font-medium">
                  {loading ? 'Привязываем...' : activate ? 'Привязать и активировать' : 'Привязать'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
