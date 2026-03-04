import React from 'react';
import KanbanBoard from './components/KanbanBoard';
import Header from './components/Header';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#0d1117] text-gray-200">
      <Header />

      <div className="max-w-7xl mx-auto py-8">
        <div className="px-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Task Overview</h2>
            <p className="text-gray-400 mt-1">Real-time status of all factory processes and automation tasks.</p>
          </div>
          
          <div className="flex space-x-3">
             {/* Future filters or actions could go here */}
          </div>
        </div>

        <KanbanBoard />
      </div>

      <footer className="border-t border-gray-800 mt-auto py-8 text-center text-sm text-gray-500">
         <p>&copy; {new Date().getFullYear()} Factory Dashboard &bull; Build 0.1.0</p>
      </footer>
    </main>
  );
}
