'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import LogModal from './LogModal';
import TaskDetailModal from './TaskDetailModal';

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
  assigned_agent?: string | null;
}

const STATUSES = ['TRIAGE', 'TODO', 'PENDING_APPROVAL', 'IN_PROGRESS', 'AUDITING', 'DONE', 'FAILED'];

const STATUS_COLORS: Record<string, string> = {
  TRIAGE: 'bg-indigo-900/30 text-indigo-400 border-indigo-500/50',
  TODO: 'bg-blue-900/30 text-blue-400 border-blue-500/50',
  PENDING_APPROVAL: 'bg-purple-900/30 text-purple-400 border-purple-500/50',
  IN_PROGRESS: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/50',
  AUDITING: 'bg-emerald-900/30 text-emerald-400 border-emerald-500/50',
  DONE: 'bg-green-900/30 text-green-400 border-green-500/50',
  FAILED: 'bg-red-900/30 text-red-400 border-red-500/50',
};

interface Project {
  name: string;
  port?: number | null;
  domain?: string | null;
}

function KanbanBoardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(searchParams.get('project') || 'all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // Log Viewer State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedTaskForLogs, setSelectedTaskForLogs] = useState<{id: number, project: string} | null>(null);

  // Task Detail State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Update selectedProject when URL changes
  useEffect(() => {
    const projectFromUrl = searchParams.get('project') || 'all';
    if (projectFromUrl !== selectedProject) {
      setSelectedProject(projectFromUrl);
    }
  }, [searchParams]);

  const handleProjectSelect = (projectName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (projectName === 'all') {
      params.delete('project');
    } else {
      params.set('project', projectName);
    }
    router.push(`/?${params.toString()}`);
  };

  const fetchTasks = React.useCallback(async () => {
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        fetch(selectedProject === 'all' ? '/api/tasks' : `/api/tasks?project_name=${selectedProject}`),
        fetch('/api/projects'),
      ]);

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
      }
      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-gray-500 font-medium">Loading tasks...</p>
      </div>
    );
  }

  const handleApprove = async (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      if (res.ok) {
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'APPROVED' } : t));
      } else {
        console.error('Failed to approve task');
      }
    } catch (error) {
      console.error('Failed to approve task:', error);
    }
  };

  const activeProject = projects.find(p => p.name === selectedProject);

  const filteredTasks = showCompleted
    ? tasks
    : tasks.filter(t => t.status !== 'DONE' && t.status !== 'FAILED');

  const tasksByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = filteredTasks.filter((task) => {
      const taskStatus = task.status || 'TRIAGE';
      if (status === 'TODO') return taskStatus === 'READY' || taskStatus === 'APPROVED';
      if (status === 'DONE') return taskStatus === 'DONE';
      if (status === 'FAILED') return taskStatus === 'FAILED';
      return taskStatus === status;
    });
    return acc;
  }, {} as Record<string, Task[]>);

  const visibleStatuses = showCompleted
    ? STATUSES
    : STATUSES.filter(s => s !== 'DONE' && s !== 'FAILED');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between px-6 gap-4">
        <div className="flex overflow-x-auto space-x-2 pb-2 md:pb-0 scrollbar-hide">
           <button
              onClick={() => handleProjectSelect('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap border ${selectedProject === 'all' ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-lg' : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'}`}
           >
             All Projects
           </button>
           {projects.map((p) => (
             <button
                key={p.name}
                onClick={() => handleProjectSelect(p.name)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap border ${selectedProject === p.name ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-lg' : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'}`}
             >
               {p.name}
             </button>
           ))}
        </div>

        <div className="flex items-center space-x-3 bg-gray-800/50 p-1.5 rounded-lg border border-gray-700 self-start md:self-auto">
          <span className="text-xs text-gray-400 px-2 font-medium">View:</span>
          <button
            onClick={() => setShowCompleted(true)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${showCompleted ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            All
          </button>
          <button
            onClick={() => setShowCompleted(false)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${!showCompleted ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Active
          </button>
        </div>
      </div>

      {activeProject && (
        <div className="mx-6 p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl flex flex-wrap gap-6 items-center">
          <div>
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Project Name</span>
            <h3 className="text-lg font-bold text-white">{activeProject.name}</h3>
          </div>
          {activeProject.domain && (
            <div>
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Domain</span>
              <p className="text-sm text-gray-300">{activeProject.domain}</p>
            </div>
          )}
          {activeProject.port && (
            <div>
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Local Port</span>
              <p className="text-sm text-gray-300 font-mono">{activeProject.port}</p>
            </div>
          )}
          <div className="ml-auto">
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Project Stats</span>
            <p className="text-sm text-gray-300">{tasks.length} Total Tasks</p>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-2 ${visibleStatuses.length > 2 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-6 px-6 pb-6 overflow-x-auto`}>
        {visibleStatuses.map((status) => (
          <div key={status} className="flex flex-col min-w-[280px] bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-sm font-semibold tracking-wider text-gray-400 uppercase">
                {status.replace('_', ' ')}
              </h2>
              <span className="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                {tasksByStatus[status].length}
              </span>
            </div>
            
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-250px)] pr-2 scrollbar-thin scrollbar-thumb-gray-700">
              {tasksByStatus[status].map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-lg border bg-gray-900 hover:border-gray-500 transition-all duration-200 cursor-pointer shadow-lg group ${STATUS_COLORS[status] || 'border-gray-700'}`}
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold opacity-70 uppercase tracking-tighter">
                      {task.project_name || 'Generic'}
                    </span>
                    {task.priority !== null && (
                      <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">
                        P{task.priority}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-white mb-2 line-clamp-2">
                    {task.title || `Task #${task.id}`}
                  </h3>
                  {task.description && (
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3">
                      {task.description}
                    </p>
                  )}
                  {task.status === 'PENDING_APPROVAL' && (
                    <button
                      onClick={(e) => handleApprove(task.id, e)}
                      className="w-full mb-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded transition-colors uppercase tracking-wider"
                    >
                      Approve Task
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTaskForLogs({ 
                        id: task.id, 
                        project: task.project_name || 'factory-dashboard' 
                      });
                      setIsLogModalOpen(true);
                    }}
                    className="w-full mb-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-bold rounded transition-colors uppercase tracking-wider flex items-center justify-center gap-2 border border-gray-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    View Logs
                  </button>

                  <div className="flex items-center justify-between text-[10px] text-gray-500 mt-2">
                    <span>ID: {task.id}</span>
                    {task.retry_count && task.retry_count > 0 ? (
                      <span className="text-orange-400">Retries: {task.retry_count}</span>
                    ) : null}
                  </div>
                </div>
              ))}
              {tasksByStatus[status].length === 0 && (
                <div className="flex items-center justify-center h-20 border border-dashed border-gray-700 rounded-lg text-gray-600 text-sm italic">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedTaskForLogs && (
        <LogModal
          isOpen={isLogModalOpen}
          onClose={() => setIsLogModalOpen(false)}
          taskId={selectedTaskForLogs.id}
          projectName={selectedTaskForLogs.project}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onRefresh={fetchTasks}
        />
      )}
    </div>
  );
}

export default function KanbanBoard() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-gray-500 font-medium">Loading board...</p>
      </div>
    }>
      <KanbanBoardContent />
    </Suspense>
  );
}
