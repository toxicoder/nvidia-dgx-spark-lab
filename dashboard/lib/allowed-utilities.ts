/** Allow-list of utilities invokable from the dashboard (security boundary). */
export const ALLOWED_UTILITIES = new Set(["spark-clock", "system-update", "sync-ollama-models", "dev-workspaces"]);
