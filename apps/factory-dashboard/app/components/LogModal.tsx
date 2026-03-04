'use client';

import React, { useState, useEffect, useRef } from 'react';

interface LogModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: number;
  projectName: string;
}

export default function LogModal({ isOpen, onClose, taskId, projectName }: LogModalProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [offset, setOffset] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLogs([]);
    setOffset(null);
    setIsLoading(true);
    setError(null);

    async function initialFetch() {
      try {
        const response = await fetch(`/api/logs?type=task&task_id=${taskId}&project=${projectName}&lines=200`);
        if (!response.ok) {
          if (response.status === 404) {
             throw new Error('Log file not found yet. Task might not have started or logs are unavailable.');
          }
          throw new Error('Failed to fetch initial logs');
        }
        
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
  }, [isOpen, taskId, projectName]);

  // Polling fetch
  useEffect(() => {
    if (!isOpen || offset === null) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/logs?type=task&task_id=${taskId}&project=${projectName}&offset=${offset}`);
        if (!response.ok) return; 
        
        const text = await response.text();
        if (text) {
          const newLines = text.split('\n').filter(line => line.length > 0);
          setLogs(prev => [...prev, ...newLines].slice(-1000));
          
          const newOffset = response.headers.get('X-Log-Offset');
          if (newOffset) setOffset(parseInt(newOffset, 10));
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, offset, taskId, projectName]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-[#0d1117] border border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-3">
             <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
               </svg>
             </div>
             <div>
               <h2 className="text-sm font-bold text-white uppercase tracking-wider">Task Logs</h2>
               <p className="text-[10px] text-gray-500 font-mono">ID: {taskId} | Project: {projectName}</p>
             </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 border ${
                autoScroll 
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' 
                  : 'bg-gray-800 text-gray-400 border-gray-700'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${autoScroll ? 'bg-blue-400 animate-pulse' : 'bg-gray-500'}`}></div>
              {autoScroll ? 'Live' : 'Paused'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 bg-[#010409] overflow-y-auto p-4 font-mono custom-scrollbar"
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <p className="text-xs uppercase tracking-widest font-bold">Loading execution logs...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-red-400/80 p-6 text-center space-y-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 italic text-sm">
              Log file is empty.
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((line, i) => (
                <LogLine key={i} content={line} />
              ))}
            </div>
          )}
        </div>
        
        <div className="p-2 px-4 border-t border-gray-800 bg-gray-900/30 flex justify-between items-center">
            <span className="text-[10px] text-gray-600 font-mono">{logs.length} lines fetched</span>
            <span className="text-[10px] text-gray-600 font-mono italic">ESC to close</span>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0d1117;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #30363d;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #484f58;
        }
      `}</style>
    </div>
  );
}

function LogLine({ content }: { content: string }) {
  const getLineColor = (text: string) => {
    if (text.includes('ERROR') || text.includes('FATAL')) return 'text-red-400';
    if (text.includes('WARN')) return 'text-yellow-400';
    if (text.includes('INFO')) return 'text-blue-300';
    if (text.includes('SUCCESS')) return 'text-green-400';
    if (text.match(/^\d{4}-\d{2}-\d{2}/)) return 'text-gray-500';
    return 'text-gray-300';
  };

  const timestampMatch = content.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^ ]*)\s*(.*)$/);
  
  if (timestampMatch) {
    const [, timestamp, rest] = timestampMatch;
    return (
      <div className="text-[11px] leading-relaxed break-all group">
        <span className="text-gray-600 mr-3 select-none">{timestamp}</span>
        <span className={getLineColor(rest)}>{rest}</span>
      </div>
    );
  }

  return (
    <div className={`text-[11px] leading-relaxed break-all ${getLineColor(content)}`}>
      {content}
    </div>
  );
}
