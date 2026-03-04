"use client";

import { useState } from "react";
import Link from "next/link";

interface Project {
  name: string;
  port: number | null;
  domain: string | null;
  commits: string[];
}

export default function AppsTable({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [domainValue, setDomainValue] = useState("");
  const [deploying, setDeploying] = useState<string | null>(null);
  const [deployStatus, setDeployStatus] = useState<Record<string, "ok" | "error">>({});

  async function saveDomain(name: string) {
    const res = await fetch(`/api/projects/${name}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: domainValue }),
    });
    if (res.ok) {
      setProjects((prev) =>
        prev.map((p) => (p.name === name ? { ...p, domain: domainValue } : p))
      );
    }
    setEditingDomain(null);
  }

  async function deploy(name: string) {
    setDeploying(name);
    setDeployStatus((prev) => ({ ...prev, [name]: undefined as unknown as "ok" }));
    try {
      const res = await fetch(`/api/projects/${name}/deploy`, { method: "POST" });
      setDeployStatus((prev) => ({ ...prev, [name]: res.ok ? "ok" : "error" }));
    } catch {
      setDeployStatus((prev) => ({ ...prev, [name]: "error" }));
    } finally {
      setDeploying(null);
      // Clear status after 4s
      setTimeout(() => setDeployStatus((prev) => { const next = { ...prev }; delete next[name]; return next; }), 4000);
    }
  }

  return (
    <div className="bg-gray-800/30 rounded-xl border border-gray-800 overflow-hidden backdrop-blur-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-800 bg-[#161b22]/50">
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Project Name</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Domain</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Port</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {projects.length > 0 ? (
            projects.map((project) => (
              <tr key={project.name} className="hover:bg-gray-800/40 transition-colors group/row">
                {/* Name with git tooltip */}
                <td className="px-6 py-4">
                  <div className="relative group inline-block">
                    <span className="text-sm font-bold text-blue-400 cursor-help border-b border-dashed border-blue-400/30 pb-0.5">
                      {project.name}
                    </span>
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-20 w-80">
                      <div className="bg-[#1c2128] border border-gray-700 rounded-lg shadow-2xl p-4 text-xs">
                        <h4 className="text-gray-400 font-bold uppercase mb-2 text-[10px] tracking-widest border-b border-gray-800 pb-1">Recent Commits</h4>
                        <ul className="space-y-2">
                          {project.commits.map((commit, i) => (
                            <li key={i} className="text-gray-300 font-mono line-clamp-2 leading-relaxed">{commit}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="w-2 h-2 bg-[#1c2128] border-r border-b border-gray-700 rotate-45 absolute -bottom-1 left-4"></div>
                    </div>
                  </div>
                </td>

                {/* Domain inline edit */}
                <td className="px-6 py-4">
                  {editingDomain === project.name ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        className="bg-gray-900 border border-blue-500 rounded px-2 py-0.5 text-sm text-white outline-none w-48"
                        value={domainValue}
                        onChange={(e) => setDomainValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveDomain(project.name);
                          if (e.key === "Escape") setEditingDomain(null);
                        }}
                      />
                      <button onClick={() => saveDomain(project.name)} className="text-xs text-green-400 hover:text-green-300">Save</button>
                      <button onClick={() => setEditingDomain(null)} className="text-xs text-gray-500 hover:text-gray-400">Cancel</button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-2 group/domain cursor-pointer"
                      onClick={() => { setEditingDomain(project.name); setDomainValue(project.domain ?? ""); }}
                    >
                      {project.domain ? (
                        <a
                          href={`https://${project.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-gray-300 hover:text-white flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>{project.domain}</span>
                          <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-sm text-gray-600 italic">No domain</span>
                      )}
                      <svg className="w-3 h-3 text-gray-600 opacity-0 group-hover/domain:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                  )}
                </td>

                {/* Port */}
                <td className="px-6 py-4">
                  <span className="text-sm font-mono text-gray-400 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
                    {project.port || "N/A"}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => deploy(project.name)}
                      disabled={deploying === project.name}
                      className={`text-xs font-medium px-3 py-1 rounded border transition-colors ${
                        deployStatus[project.name] === "ok"
                          ? "border-green-700 text-green-400 bg-green-900/20"
                          : deployStatus[project.name] === "error"
                          ? "border-red-700 text-red-400 bg-red-900/20"
                          : "border-gray-700 text-gray-400 hover:border-blue-600 hover:text-blue-400"
                      } disabled:opacity-50`}
                    >
                      {deploying === project.name
                        ? "Restarting…"
                        : deployStatus[project.name] === "ok"
                        ? "Restarted ✓"
                        : deployStatus[project.name] === "error"
                        ? "Failed ✗"
                        : "Deploy"}
                    </button>
                    <Link
                      href={`/?project=${project.name}`}
                      className="text-xs font-medium text-gray-500 hover:text-blue-400 transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">
                No projects found in the factory database.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
