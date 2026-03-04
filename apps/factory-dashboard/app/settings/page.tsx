import prisma from "@/lib/prisma";
import SettingsTabs from "@/app/components/SettingsTabs";
import Header from "@/app/components/Header";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [providers, roles] = await Promise.all([
    prisma.agentProvider.findMany({ orderBy: { id: "asc" } }),
    prisma.agentRoleConfig.findMany({ orderBy: { id: "asc" } }),
  ]);

  return (
    <main className="min-h-screen bg-[#0d1117] text-gray-200">
      <Header />

      <div className="max-w-4xl mx-auto py-8">
        <div className="px-6 mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-gray-400 mt-1">Manage AI agents and system configuration.</p>
        </div>

        <div className="px-6">
          <SettingsTabs providers={providers} roles={roles} />
        </div>
      </div>

      <footer className="border-t border-gray-800 mt-auto py-8 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Factory Dashboard &bull; Build 0.1.0</p>
      </footer>
    </main>
  );
}
