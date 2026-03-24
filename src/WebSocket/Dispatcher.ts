import { WebSocket, WebSocketServer } from 'ws';
import WSManager from '../Core/System/WSManager';
import logger from '../Core/Logger/Log';

export interface WSModule {
    type: string;
    execute: (ws: WebSocket, payload: any) => Promise<void> | void;
    init?: (wss: WebSocketServer) => void;
}

/**
 * Despachador de mensajes para WebSockets puros.
 */
export default new class WSDispatcher {
    private handlers: Map<string, WSModule> = new Map();

    /**
     * Registra un controlador.
     */
    public register(module: WSModule): void {
        this.handlers.set(module.type, module);
    }

    /**
     * Inicializa el servidor de WebSockets puros.
     */
    public init(wss: WebSocketServer, modules: WSModule[]): void {
        modules.forEach(mod => {
            this.register(mod);
            if (typeof mod.init === 'function') {
                mod.init(wss);
            }
        });

        wss.on('connection', (ws: WebSocket) => {
            logger.debug('New pure WebSocket connection');

            ws.on('message', async (data: string) => {
                try {
                    const parsed = JSON.parse(data);
                    const { type, payload } = parsed;
                    
                    const handler = this.handlers.get(type);
                    if (handler) {
                        await handler.execute(ws, payload);
                    } else {
                        logger.warn({ type }, 'WS Unknown message type received');
                    }
                } catch (err) {
                    logger.error({ error: err }, 'WS Message parsing error');
                }
            });

            ws.on('close', () => {
                WSManager.remove(ws);
                logger.debug('Pure WebSocket connection closed');
            });

            ws.on('error', (err) => {
                logger.error({ error: err }, 'WS Socket error');
                WSManager.remove(ws);
            });
        });
    }
}
