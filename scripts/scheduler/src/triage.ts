import { AgentRole } from "./agent-runner.js";

export type Difficulty = "low" | "medium" | "high";

export interface TriageResult {
  agentRole: AgentRole;
  difficulty: Difficulty;
}

const UI_KEYWORDS = /\b(ui|frontend|component|css|style|button|layout|modal|form|page|design)\b/i;
const ARCH_KEYWORDS = /\b(architect|schema|database|migration|infrastructure|deploy|docker|api design|system|integration|security|auth)\b/i;
const HIGH_EFFORT_KEYWORDS = /\b(complex|refactor|migrate|architecture|redesign)\b/i;

export function triageTask(task: {
  title: string;
  description: string;
  priority: number;
}): TriageResult {
  const titleLower = task.title.toLowerCase();
  const descLower = task.description.toLowerCase();
  const combinedText = `${titleLower} ${descLower}`;
  const descLength = task.description.length;

  // Determine difficulty
  let difficulty: Difficulty;
  if (
    task.priority >= 8 ||
    descLength > 800 ||
    HIGH_EFFORT_KEYWORDS.test(combinedText)
  ) {
    difficulty = "high";
  } else if (task.priority <= 3 && descLength < 200) {
    difficulty = "low";
  } else {
    difficulty = "medium";
  }

  // Determine agent role based on type and difficulty
  let agentRole: AgentRole = "developer";

  if (UI_KEYWORDS.test(combinedText) && difficulty !== "high") {
    agentRole = "ui-developer";
  } else if (
    ARCH_KEYWORDS.test(combinedText) &&
    (difficulty === "high" || task.priority >= 8)
  ) {
    agentRole = "architect";
  }

  return { agentRole, difficulty };
}
