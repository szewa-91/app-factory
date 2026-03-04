'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from './LogoutButton';

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-gray-800 bg-[#161b22]/50 backdrop-blur-md sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center shadow-lg shadow-blue-900/20">
              <span className="font-bold text-white">F</span>
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-white">Factory Dashboard</h1>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-1">
            <Link 
              href="/" 
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pathname === '/' ? 'text-blue-400 bg-blue-400/10' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
            >
              Tasks
            </Link>
            <Link 
              href="/apps" 
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pathname === '/apps' ? 'text-blue-400 bg-blue-400/10' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
            >
              Applications
            </Link>
            <Link 
              href="/logs" 
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pathname === '/logs' ? 'text-blue-400 bg-blue-400/10' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
            >
              Logs
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center space-x-4">
           <div className="hidden sm:flex items-center space-x-2 bg-gray-800/50 px-3 py-1 rounded-full border border-gray-700">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">System Live</span>
           </div>
           <LogoutButton />
        </div>
      </div>
    </header>
  );
}
