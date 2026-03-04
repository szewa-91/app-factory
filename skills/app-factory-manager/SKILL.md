# App Factory Manager - Expert Skill

This skill provides procedural guidance for managing applications within the App Factory environment, ensuring consistency, security, and adherence to established infrastructure standards (Coolify, Docker, Traefik).

## <instructions>
### 1. Bootstrapping a New App
When asked to create a new application, follow these steps:
1. **Initialize Directory**: Create a dedicated directory under `apps/` (e.g., `apps/my-new-app`).
2. **Setup Base Project**: Use `npx create-next-app@latest .` (if web) or the appropriate tool for the requested stack. Ensure non-interactive mode.
3. **Apply Deployment Template**:
   - Copy `Dockerfile.template`, `docker-compose.yml.template`, and `deploy.sh.template` from `templates/default`.
   - Rename them by removing the `.template` suffix.
4. **Configure Environment**:
   - Create a `.env.example` file with necessary keys (e.g., `DATABASE_URL`, `NEXT_PUBLIC_API_URL`).
   - Setup a `next.config.ts` (or `next.config.js`) for standalone mode:
     ```typescript
     const nextConfig = {
       output: 'standalone',
     };
     ```
5. **Adjust Docker Compose**:
   - Set the `Host` rule in Traefik labels to the target domain (e.g., `my-app.marcinszewczyk.pl`).
   - Ensure the `coolify` network is specified.

### 2. Deployment Protocol
Follow this protocol when deploying an application:
1. **Validation**: Ensure `npm run build` passes locally (or within the builder stage of Docker).
2. **Environment Synchronization**: Verify that all required environment variables are present in the target environment (VPS).
3. **Execution**: Run `./deploy.sh` within the application directory.
4. **Verification**: Monitor logs using `docker compose logs -f` and verify the application is accessible at the configured URL.

### 3. Standards Compliance Checklist
- [ ] Network is set to `coolify`.
- [ ] Traefik entrypoint is `https`.
- [ ] Certresolver is `letsencrypt`.
- [ ] Next.js is in `standalone` mode.
- [ ] Docker user is set (prefer `1000:1000`).
- [ ] Ports are NOT exposed directly on the host.

### 4. Integration with Codex-Autorunner (CAR)
When coordinating with CAR:
- Create and update markdown tickets in the `.codex/tickets/` directory.
- Use the Project Manager Agent (PMA) to oversee multi-stage tasks.
- Log task progress and outcomes within the ticket files.
</instructions>

## <available_resources>
- `templates/default`: Base deployment templates.
- `apps/`: Directory for application source code.
- `deploy.sh`: Script template for building and restarting containers.
</available_resources>
