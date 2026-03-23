/**
 * Feature Flags — Singleton
 *
 * Fase 1 (sin SQLite): isEnabled() lee el campo `enabled` del objeto de ruta/socket.
 * Fase 2 (con SQLite): los overrides de BD tienen prioridad sobre el valor estático.
 *
 * Tabla SQLite esperada:
 *   CREATE TABLE IF NOT EXISTS feature_flags (
 *     name TEXT PRIMARY KEY,
 *     enabled INTEGER NOT NULL,
 *     updated_at INTEGER NOT NULL
 *   );
 */
export default new class FeatureFlags {
    /** name → enabled override (loaded from DB or set programmatically) */
    private overrides: Map<string, boolean> = new Map();

    /**
     * Returns whether a feature is enabled.
     * Priority: DB override > staticValue > default true.
     */
    public isEnabled(name: string, staticValue?: boolean): boolean {
        if (this.overrides.has(name)) {
            return this.overrides.get(name)!;
        }
        return staticValue ?? true;
    }

    /**
     * Load overrides from SQLite.
     * If no DB is provided (or table doesn't exist), silently does nothing.
     */
    public async loadFromDB(db?: any): Promise<void> {
        if (!db) return;
        try {
            const rows: { name: string; enabled: number }[] = await db.all(
                'SELECT name, enabled FROM feature_flags'
            );
            for (const row of rows) {
                this.overrides.set(row.name, row.enabled !== 0);
            }
        } catch {
            // Table might not exist yet — safe to ignore
        }
    }

    /**
     * Set a flag in memory and optionally persist to SQLite.
     */
    public async setFlag(name: string, enabled: boolean, db?: any): Promise<void> {
        this.overrides.set(name, enabled);
        if (!db) return;
        try {
            await db.run(
                'INSERT OR REPLACE INTO feature_flags (name, enabled, updated_at) VALUES (?, ?, ?)',
                [name, enabled ? 1 : 0, Date.now()]
            );
        } catch {
            // Persist failure is non-fatal
        }
    }

    /**
     * Clear all in-memory overrides and reload from DB.
     */
    public async reload(db?: any): Promise<void> {
        this.overrides.clear();
        await this.loadFromDB(db);
    }

    /**
     * Returns all current in-memory overrides.
     */
    public getAll(): Record<string, boolean> {
        return Object.fromEntries(this.overrides);
    }
}
