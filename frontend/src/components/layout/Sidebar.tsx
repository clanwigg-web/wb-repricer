'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../../lib/store';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '📊' },
    { name: 'SKU', path: '/skus', icon: '📦' },
    { name: 'Стратегии', path: '/strategies', icon: '⚡' },
    { name: 'Аналитика', path: '/analytics', icon: '📈' },
    { name: 'Настройки', path: '/settings', icon: '⚙️' },
  ];

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-bold">WB Repricer</h1>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg mb-2 transition ${
              pathname === item.path
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.name}</span>
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 transition"
        >
          <span className="text-xl">🚪</span>
          <span>Выход</span>
        </button>
      </div>
    </div>
  );
}