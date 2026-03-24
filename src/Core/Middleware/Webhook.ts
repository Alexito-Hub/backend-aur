import { Request, Response, NextFunction } from 'express';
import logger from '../Logger/Log';

/**
 * Middleware para validar la autenticidad de los Webhooks.
 */
export default class WebhookGuard {
    /**
     * Verifica que el token enviado en el header coincida con el secreto del servidor.
     */
    public static verify(req: Request, res: Response, next: NextFunction) {
        const signature = req.headers['x-webhook-token'];
        const secret = process.env.WEBHOOK_SECRET || 'default_secret_change_me';

        if (!signature || signature !== secret) {
            logger.warn({ 
                ip: req.ip, 
                path: req.path 
            }, 'Intento de acceso a Webhook no autorizado');
            
            return res.status(401).json({
                status: false,
                msg: 'Webhook signature invalid'
            });
        }

        next();
    }
}
