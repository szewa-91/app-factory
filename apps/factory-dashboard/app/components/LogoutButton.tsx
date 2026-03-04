'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm font-medium text-gray-400 hover:text-white transition-colors px-3 py-1 rounded-md border border-gray-700 hover:bg-gray-800"
    >
      Logout
    </button>
  );
}
