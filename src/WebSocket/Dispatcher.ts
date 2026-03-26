import { WebSocket, WebSocketServer } from 'ws';
import WSManager from '../Core/System/WSManager';
import logger from '../Core/Logger/Log';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface WSMessage<P = unknown> {
    /** Matches a registered WSModule.type */
    type: string;
    /** Optional correlation id — echoed back in ACK frames */
    id?: string;
    payload: P;
}

export interface WSModule {
    type: string;
    execute: (ws: WebSocket, payload: any, id?: string) => Promise<void> | void;
    init?: (wss: WebSocketServer) => void;
}

// ─── Heartbeat config ─────────────────────────────────────────────────────────

/** How often the server pings each client (ms). */
const PING_INTERVAL_MS = 30_000;
/** How long to wait for a pong before terminating the connection (ms). */
const PONG_TIMEOUT_MS  = 10_000;

// ─── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Central dispatcher for pure WebSocket connections.
 *
 * Improvements over the original:
 *  1. Per-handler error isolation — a crash in one handler never closes
 *     the connection or affects other handlers.
 *  2. Heartbeat / ping-pong — detects zombie connections and terminates
 *     them before they accumulate in rooms.
 *  3. Typed message envelope — `{ type, id?, payload }` contract enforced
 *     at the parse step; malformed frames are rejected with a typed error
 *     response rather than silently dropped.
 *  4. Optional ACK — when the incoming frame includes an `id`, the
 *     dispatcher sends a lightweight acknowledgment so the client can
 *     implement reliable delivery on top of raw WS.
 */
export default new class WSDispatcher {
    private handlers: Map<string, WSModule> = new Map();

    /** Register a single module (called by `init`). */
    public register(module: WSModule): void {
        if (this.handlers.has(module.type)) {
            logger.warn({ type: module.type }, 'WS handler already registered — overwriting');
        }
        this.handlers.set(module.type, module);
    }

    /** Bootstrap all modules and start listening. */
    public init(wss: WebSocketServer, modules: WSModule[]): void {
        // Register + optionally let each module hook into the WSS
        for (const mod of modules) {
            this.register(mod);
            if (typeof mod.init === 'function') {
                mod.init(wss);
            }
        }

        // Start heartbeat interval
        const heartbeat = setInterval(() => {
            wss.clients.forEach((ws) => {
                const ext = ws as WebSocket & { _isAlive?: boolean; _pongTimer?: NodeJS.Timeout };
                if (ext._isAlive === false) {
                    logger.warn('WS heartbeat timeout — terminating zombie connection');
                    WSManager.remove(ws);
                    return ws.terminate();
                }
                ext._isAlive = false;
                ws.ping();

                // Secondary guard: if pong never arrives within PONG_TIMEOUT_MS
                ext._pongTimer = setTimeout(() => {
                    if (ext._isAlive === false) {
                        logger.warn('WS pong timeout — terminating connection');
                        WSManager.remove(ws);
                        ws.terminate();
                    }
                }, PONG_TIMEOUT_MS);
            });
        }, PING_INTERVAL_MS);

        wss.on('close', () => clearInterval(heartbeat));

        wss.on('connection', (ws: WebSocket) => {
            const ext = ws as WebSocket & { _isAlive?: boolean; _pongTimer?: NodeJS.Timeout };
            ext._isAlive = true;

            ws.on('pong', () => {
                ext._isAlive = true;
                if (ext._pongTimer) {
                    clearTimeout(ext._pongTimer);
                    ext._pongTimer = undefined;
                }
            });

            logger.debug('New pure WebSocket connection');

            ws.on('message', async (raw: Buffer | string) => {
                let parsed: WSMessage;

                // ── 1. Parse & validate envelope ──────────────────────────────
                try {
                    parsed = JSON.parse(raw.toString()) as WSMessage;
                    if (!parsed.type || typeof parsed.type !== 'string') {
                        throw new TypeError('Missing or invalid "type" field');
                    }
                } catch (parseErr: any) {
                    this._sendError(ws, undefined, 'INVALID_FRAME', parseErr.message);
                    return;
                }

                const { type, id, payload } = parsed;

                // ── 2. Route to handler ────────────────────────────────────────
                const handler = this.handlers.get(type);
                if (!handler) {
                    logger.warn({ type }, 'WS Unknown message type received');
                    this._sendError(ws, id, 'UNKNOWN_TYPE', `No handler registered for type "${type}"`);
                    return;
                }

                // ── 3. Execute with per-handler error isolation ────────────────
                try {
                    await handler.execute(ws, payload ?? {}, id);

                    // Optional ACK
                    if (id) {
                        this._send(ws, { type: 'ACK', id, payload: { ok: true } });
                    }
                } catch (execErr: any) {
                    logger.error(
                        { type, error: execErr?.message ?? execErr },
                        'WS Handler execution error',
                    );
                    this._sendError(ws, id, 'HANDLER_ERROR', 'Error procesando la solicitud.');
                }
            });

            ws.on('close', () => {
                WSManager.remove(ws);
                if (ext._pongTimer) clearTimeout(ext._pongTimer);
                logger.debug('Pure WebSocket connection closed');
            });

            ws.on('error', (err) => {
                logger.error({ error: err }, 'WS Socket error');
                WSManager.remove(ws);
            });
        });
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    private _send(ws: WebSocket, data: object): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    private _sendError(
        ws: WebSocket,
        id: string | undefined,
        code: string,
        detail: string,
    ): void {
        this._send(ws, {
            type: 'ERROR',
            ...(id ? { id } : {}),
            payload: { code, detail },
        });
    }
}