'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../../lib/store';

const menuItems = [
  { name: 'Dashboard', path: '/dashboard', icon: '📊' },
  { name: 'SKU', path: '/skus', icon: '📦' },
  { name: 'Стратегии', path: '/strategies', icon: '⚡' },
  { name: 'Настройки', path: '/settings', icon: '⚙️' },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen flex flex-col shrink-0">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">WB Repricer</h1>
        <p className="text-gray-400 text-sm mt-1">Автоматический репрайсер</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition text-left ${
              pathname === item.path || (pathname.startsWith(item.path) && item.path !== '/dashboard')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-sm font-medium">{item.name}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition text-left"
        >
          <span className="text-lg">🚪</span>
          <span className="text-sm font-medium">Выход</span>
        </button>
      </div>
    </div>
  );
}
