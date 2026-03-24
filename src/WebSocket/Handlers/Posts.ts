import { WebSocket, WebSocketServer } from 'ws';
import WSManager from '../../Core/System/WSManager';
import logger from '../../Core/Logger/Log';

let _wss: WebSocketServer | null = null;

export default {
    type: "POSTS",
    
    /**
     * Inicialización del servidor para permitir broadcasting desde fuera.
     */
    init(wss: WebSocketServer) {
        _wss = wss;
        logger.info('Pure WebSocket Posts handler initialized');
    },

    /**
     * Ejecución de mensajes entrantes.
     */
    async execute(ws: WebSocket, payload: any) {
        const { action } = payload;

        switch (action) {
            case 'subscribe':
                WSManager.join('posts_feed', ws);
                ws.send(JSON.stringify({
                    type: "POSTS",
                    payload: { status: "success", message: "Suscrito a actualizaciones de posts (Pure WS)" }
                }));
                logger.debug('Cliente suscrito a posts via Pure WS');
                break;

            case 'unsubscribe':
                WSManager.leave('posts_feed', ws);
                logger.debug('Cliente desuscrito de posts via Pure WS');
                break;

            default:
                logger.warn({ action }, 'Acción desconocida en el canal de POSTS');
        }
    },

    /**
     * Emisores auxiliares (para ser llamados desde los controladores de la API)
     */
    emitNewPost(postData: any) {
        WSManager.to('posts_feed', {
            type: "POSTS",
            payload: {
                action: "create",
                post: postData,
                timestamp: Date.now()
            }
        });
        logger.info({ postId: postData._id }, "Nuevo post emitido via Pure WS");
    },

    emitUpdatePost(postData: any) {
        WSManager.to('posts_feed', {
            type: "POSTS",
            payload: {
                action: "update",
                post: postData,
                timestamp: Date.now()
            }
        });
    }
}
