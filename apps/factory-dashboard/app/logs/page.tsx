'use client';

import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';

export default function LogsPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [offset, setOffset] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial fetch
  useEffect(() => {
    async function initialFetch() {
      try {
        const response = await fetch('/api/logs?type=factory&lines=200');
        if (!response.ok) throw new Error('Failed to fetch initial logs');
        
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.length > 0);
        setLogs(lines);
        
        const newOffset = response.headers.get('X-Log-Offset');
        if (newOffset) setOffset(parseInt(newOffset, 10));
        
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setIsLoading(false);
      }
    }
    
    initialFetch();
  }, []);

  // Polling fetch
  useEffect(() => {
    if (offset === null) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/logs?type=factory&offset=${offset}`);
        if (!response.ok) return; // Silent fail for polling
        
        const text = await response.text();
        if (text) {
          const newLines = text.split('\n').filter(line => line.length > 0);
          setLogs(prev => [...prev, ...newLines].slice(-1000)); // Keep last 1000 lines
          
          const newOffset = response.headers.get('X-Log-Offset');
          if (newOffset) setOffset(parseInt(newOffset, 10));
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [offset]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const clearLogs = () => setLogs([]);

  return (
    <main className="min-h-screen bg-[#0d1117] text-gray-200 font-mono">
      <Header />

      <div className="max-w-7xl mx-auto py-8 px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span>
              System Logs
            </h2>
            <p className="text-gray-400 mt-1 font-sans">Live feed from factory.log</p>
          </div>

          <div className="flex items-center gap-3 font-sans">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                autoScroll 
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${autoScroll ? 'bg-blue-400' : 'bg-gray-500'}`}></div>
              Auto-scroll
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-md text-sm font-medium transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="relative">
          <div 
            ref={scrollRef}
            className="w-full h-[70vh] bg-[#010409] border border-gray-800 rounded-lg overflow-y-auto p-4 shadow-2xl custom-scrollbar"
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-gray-500 animate-pulse">
                Initializing terminal...
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-red-400">
                Error: {error}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-gray-600 italic">No logs found or logs cleared.</div>
            ) : (
              <div className="space-y-1">
                {logs.map((line, i) => (
                  <LogLine key={i} content={line} />
                ))}
              </div>
            )}
          </div>
          <div className="absolute bottom-4 right-8 text-[10px] text-gray-600 pointer-events-none">
            {logs.length} lines visible
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0d1117;
          border-radius: 0 8px 8px 0;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #30363d;
          border-radius: 5px;
          border: 2px solid #0d1117;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #484f58;
        }
      `}</style>
    </main>
  );
}

function LogLine({ content }: { content: string }) {
  // Simple colorization based on common log patterns
  const getLineColor = (text: string) => {
    if (text.includes('ERROR') || text.includes('FATAL')) return 'text-red-400';
    if (text.includes('WARN')) return 'text-yellow-400';
    if (text.includes('INFO')) return 'text-blue-300';
    if (text.includes('SUCCESS')) return 'text-green-400';
    if (text.match(/^\d{4}-\d{2}-\d{2}/)) return 'text-gray-500'; // Timestamp
    return 'text-gray-300';
  };

  // Extract timestamp if it exists to dim it
  const timestampMatch = content.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^ ]*)\s*(.*)$/);
  
  if (timestampMatch) {
    const [, timestamp, rest] = timestampMatch;
    return (
      <div className="text-xs leading-relaxed break-all group">
        <span className="text-gray-600 mr-3 select-none">{timestamp}</span>
        <span className={getLineColor(rest)}>{rest}</span>
      </div>
    );
  }

  return (
    <div className={`text-xs leading-relaxed break-all ${getLineColor(content)}`}>
      {content}
    </div>
  );
}
