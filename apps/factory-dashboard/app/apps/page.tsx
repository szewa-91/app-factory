import React from 'react';
import { execSync } from 'child_process';
import prisma from '@/lib/prisma';
import Header from '../components/Header';
import AppsTable from '../components/AppsTable';

export const dynamic = 'force-dynamic';

interface ProjectWithCommits {
  name: string;
  port: number | null;
  domain: string | null;
  commits: string[];
}

async function getProjectsWithCommits(): Promise<ProjectWithCommits[]> {
  const projects = await prisma.project.findMany({
    orderBy: { created_at: 'desc' },
  });

  return projects.map((project) => {
    let commits: string[] = [];
    try {
      const projectPath = `/app-factory/apps/${project.name}`;
      const output = execSync(
        `git -C "${projectPath}" log -n 3 --format="%h - %s (%cr)"`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      );
      commits = output.split('\n').filter(Boolean);
    } catch {
      commits = ['No commit history available'];
    }

    return { ...project, commits };
  });
}

export default async function AppsPage() {
  const projects = await getProjectsWithCommits();

  return (
    <main className="min-h-screen bg-[#0d1117] text-gray-200">
      <Header />

      <div className="max-w-7xl mx-auto py-8 px-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white tracking-tight">Applications</h2>
          <p className="text-gray-400 mt-1">Status and configuration of all projects managed by the factory.</p>
        </div>

        <AppsTable initialProjects={projects} />
      </div>

      <footer className="border-t border-gray-800 mt-auto py-8 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Factory Dashboard &bull; Build 0.1.0</p>
      </footer>
    </main>
  );
}
