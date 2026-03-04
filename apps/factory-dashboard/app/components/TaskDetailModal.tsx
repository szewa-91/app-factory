'use client';

import React, { useState, useEffect } from 'react';

interface Task {
  id: number;
  project_name: string | null;
  title: string | null;
  status: string | null;
  priority: number | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
  retry_count: number | null;
  depends_on: string | null;
  audit_notes?: string | null;
  assigned_agent?: string | null;
}

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onRefresh: () => void;
}

export default function TaskDetailModal({ task, onClose, onRefresh }: TaskDetailModalProps) {
  const [priority, setPriority] = useState<string>(task.priority?.toString() ?? '');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handlePriorityCommit = async () => {
    const newPriority = parseInt(priority, 10);
    if (isNaN(newPriority) || newPriority === task.priority) return;

    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete task #${task.id} "${task.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to delete task:', err);
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0d1117] border border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Task Detail</h2>
              <p className="text-[10px] text-gray-500 font-mono">ID: {task.id} | {task.project_name || 'No project'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Title</label>
            <p className="text-white font-medium mt-1">{task.title || `Task #${task.id}`}</p>
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Status</label>
              <p className="text-gray-300 font-mono text-sm mt-1">{task.status ?? '—'}</p>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Priority</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                onBlur={handlePriorityCommit}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePriorityCommit(); }}
                className="mt-1 w-24 bg-gray-800 border border-gray-700 focus:border-blue-500 text-white text-sm rounded px-2 py-1 font-mono outline-none"
              />
            </div>
          </div>

          {/* Assigned Agent */}
          {task.assigned_agent && (
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Assigned Agent</label>
              <p className="text-indigo-400 font-mono text-sm mt-1">{task.assigned_agent}</p>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Description</label>
              <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Depends on */}
          {task.depends_on && (
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Depends On</label>
              <p className="text-gray-300 font-mono text-sm mt-1">{task.depends_on}</p>
            </div>
          )}

          {/* Audit notes */}
          {task.audit_notes && (
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Audit Notes</label>
              <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">{task.audit_notes}</p>
            </div>
          )}

          {/* Metadata row */}
          <div className="grid grid-cols-2 gap-4 text-[11px] font-mono">
            <div>
              <span className="text-gray-500">Retry count: </span>
              <span className={task.retry_count && task.retry_count > 0 ? 'text-orange-400' : 'text-gray-400'}>
                {task.retry_count ?? 0}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Created: </span>
              <span className="text-gray-400">{task.created_at ? new Date(task.created_at).toLocaleString() : '—'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Updated: </span>
              <span className="text-gray-400">{task.updated_at ? new Date(task.updated_at).toLocaleString() : '—'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/30 flex justify-between items-center">
          <span className="text-[10px] text-gray-600 font-mono italic">ESC to close · blur or Enter to save priority</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 bg-red-900/40 hover:bg-red-800/60 border border-red-700/50 text-red-400 text-[10px] font-bold uppercase tracking-wider rounded transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
