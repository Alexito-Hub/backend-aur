import { Request, Response, NextFunction } from 'express';
import admin from '../Database/Firebase';

export default new class Check {
    public token = async (req: Request, res: Response, next: NextFunction) => {
        const appCheckToken = req.header('X-Firebase-AppCheck');

        if (!appCheckToken) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('Missing App Check token, but allowing in development.');
                return next();
            }
            return res.status(401).json({
                status: false,
                msg: 'No autorizado: Falta token de App Check.'
            });
        }

        try {
            await admin.appCheck().verifyToken(appCheckToken);
            next();
        } catch (err) {
            console.error('App Check verification failed:', err);
            return res.status(401).json({
                status: false,
                msg: 'No autorizado: Token de App Check inválido.'
            });
        }
    };
}
