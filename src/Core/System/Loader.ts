import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import logger from '../Logger/Log';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const resolve = path.resolve;

export default new class Loader {
    public plugins: any[] = [];
    public sockets: any[] = [];
    public websockets: any[] = [];
    public resolvers: any[] = [];

    public async router(dir: string): Promise<void> {
        this.plugins = [];
        const files = await this.scandir(dir);
        for (const file of files) {
            if (file.endsWith('.ts') || file.endsWith('.js')) {
                try {
                    const mod = await import(file);
                    const plugin = mod.default || mod;
                    if (plugin && typeof plugin === 'object') {
                        (plugin as any).__filePath = file;
                    }
                    this.plugins.push(plugin);
                    logger.info({ file }, 'Route loaded successfully');
                } catch (err: any) {
                    logger.error({ file, error: err.message }, 'Error importing router');
                }
            }
        }
    }

    public async socket(dir: string): Promise<void> {
        this.sockets = [];
        const files = await this.scandir(dir);
        for (const file of files) {
            if (file.endsWith('.ts') || file.endsWith('.js')) {
                try {
                    const mod = await import(file);
                    this.sockets.push(mod.default || mod);
                    logger.info({ file }, 'Socket loaded successfully');
                } catch (err: any) {
                    logger.error({ file, error: err.message }, 'Error importing socket');
                }
            }
        }
    }

    public async websocketPure(dir: string): Promise<void> {
        this.websockets = [];
        const files = await this.scandir(dir);
        for (const file of files) {
            if (file.endsWith('.ts') || file.endsWith('.js')) {
                try {
                    const mod = await import(file);
                    this.websockets.push(mod.default || mod);
                    logger.info({ file }, 'Pure WebSocket loaded successfully');
                } catch (err: any) {
                    logger.error({ file, error: err.message }, 'Error importing pure websocket');
                }
            }
        }
    }

    /**
     * Load GraphQL resolvers from a directory.
     *
     * FIX: The previous implementation appended to `this.resolvers` without ever
     * clearing it. On hot-reload (ts-node-dev) or repeated test runs this caused
     * every resolver to be registered N times, leading to:
     *   - Duplicate entries in Config.graphql.queries
     *   - The resolver merge log-spam ("collision detected") on every restart
     *
     * We now reset the array before each scan so the list always reflects the
     * current state of the file system.
     */
    public async resolver(dir: string): Promise<void> {
        // ─── Reset before re-scanning ─────────────────────────────────────────
        this.resolvers = [];

        const files = await this.scandir(dir);
        for (const file of files) {
            if (file.endsWith('.ts') || file.endsWith('.js')) {
                try {
                    const mod = await import(file);
                    this.resolvers.push(mod.default || mod);
                    logger.info({ file }, 'Resolver loaded successfully');
                } catch (err: any) {
                    logger.error({ file, error: err.message }, 'Error importing resolver');
                }
            }
        }
    }

    private async scandir(dir: string): Promise<string[]> {
        const subdirs = await readdir(dir);
        const files = await Promise.all(subdirs.map(async (subdir) => {
            const res = resolve(dir, subdir);
            try {
                return (await stat(res)).isDirectory() ? this.scandir(res) : res;
            } catch (err: any) {
                logger.error({ dir: res, error: err.message }, 'Error reading directory');
                return [];
            }
        }));
        return files.flat();
    }
}