# App Factory - Architecture & Future Improvements

This document tracks planned architectural enhancements to make the App Factory more robust, scalable, and autonomous.

## 1. "Zero-Port" Isolation (Infrastructure)
- **Goal**: Eliminate the need for dynamic port allocation (3001-3999).
- **Concept**: Since apps communicate via the internal `coolify` Docker network, every Next.js app can run on port `3000` inside its container.
- **Action**: Update `bootstrap.sh` and `docker-compose.yml.template` to use port 3000 by default and rely solely on Traefik's `Host()` labels for routing.

## 2. Self-Healing & Error Feedback (Execution)
- **Goal**: Enable agents to learn from previous failures.
- **Concept**: If a task fails or the Health Check fails, save the error output to a `PREVIOUS_FAILURE.log`.
- **Action**: Modify `scheduler.sh` to include this failure context in the next retry's prompt.

## 3. Dynamic Tasking & Self-Decomposition (Intelligence)
- **Goal**: Prevent agent timeouts on overly complex tasks.
- **Concept**: Allow agents to read/write to `factory.db`.
- **Action**: Instruct agents (via `GEMINI.md`) that they can "break down" a large task by inserting new sub-tasks into the database and marking the parent as `DONE`.

## 4. Per-Task Log Versioning (Monitoring)
- **Goal**: Traceability of all historical implementations.
- **Concept**: Instead of overwriting `agent.log`, save logs as `agent_task_<ID>.log`.
- **Action**: Update `scheduler.sh` to version logs and provide links in the Factory Dashboard.
