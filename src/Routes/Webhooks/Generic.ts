import { Request, Response } from 'express';
import WebhookGuard from '../../Core/Middleware/Webhook';
import PurePostWS from '../../WebSocket/Handlers/Posts';
import SocketIOPosts from '../../Socket/posts';
import logger from '../../Core/Logger/Log';

export default {
    name: "generic_webhook",
    category: "webhooks",
    path: "/v1/webhooks/trigger",
    method: "post",
    enabled: true,
    // Usamos el middleware de validación que creamos
    validator: WebhookGuard.verify,

    async execution(req: Request, res: Response) {
        try {
            const { event, data } = req.body;

            if (!event || !data) {
                return res.status(400).json({ 
                    status: false, 
                    msg: "Payload incompleto" 
                });
            }

            logger.info({ event }, 'Webhook recibido y validado');

            // 1. Notificar a través de WebSockets Puros
            if (event === 'NEW_POST') {
                PurePostWS.emitNewPost({
                    _id: data.id || "system",
                    text: `Nuevo post desde Webhook: ${data.content}`,
                    user: data.author || "Sistema Externo"
                });

                // 2. Notificar a través de Socket.io (Opcional, si quieres ambos)
                SocketIOPosts.emitNewPost({
                    _id: data.id || "system",
                    text: data.content,
                    author: data.author
                });
            }

            // El Webhook siempre debe responder rápido
            res.status(200).json({
                status: true,
                msg: "Webhook procesado y emitido a Sockets",
                processed_at: new Date().toISOString()
            });

        } catch (err) {
            logger.error({ error: err }, "Error procesando Webhook");
            res.status(500).json({ status: false, msg: "Internal server error" });
        }
    }
};
