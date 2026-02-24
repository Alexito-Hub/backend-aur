import { Request, Response, NextFunction } from 'express';

export default new class AppToken {
    /**
     * Validates strictly that the request comes from our trusted clients.
     * Requires a custom header `x-app-token`.
     */
    public token = (req: Request, res: Response, next: NextFunction) => {
        const appToken = req.headers['x-app-token'];
        const expectedToken = process.env.APP_SECRET_TOKEN;

        if (!expectedToken) {
            console.error('CRITICAL: APP_SECRET_TOKEN is not defined in the environment.');
            return res.status(500).json({
                status: false,
                msg: 'Error interno: El servidor no está configurado correctamente.'
            });
        }

        if (!appToken || appToken !== expectedToken) {
            return res.status(403).json({
                status: false,
                msg: 'Acceso denegado: Token de aplicación inválido.'
            });
        }

        next();
    };
}
