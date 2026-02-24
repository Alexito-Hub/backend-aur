import { Request, Response, NextFunction } from 'express';

export default new class AppToken {
    /**
     * Validates strictly that the request comes from our trusted clients.
     * Requires a custom header `x-app-token`.
     */
    public token = (req: Request, res: Response, next: NextFunction) => {
        const appToken = req.headers['x-app-token'];
        const expectedToken = process.env.APP_SECRET_TOKEN || 'mediakeep_default_secret_dev';

        if (!appToken || appToken !== expectedToken) {
            return res.status(403).json({
                status: false,
                msg: 'Acceso denegado: Token de aplicación inválido.'
            });
        }

        next();
    };
}
