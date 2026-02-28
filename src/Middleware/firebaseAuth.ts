import { Request, Response, NextFunction } from 'express';
import admin from '../Config/firebase';

export default new class FirebaseAuth {
    /**
     * Validates the Firebase ID token for authenticated routes.
     */
    public auth = async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: false,
                msg: 'No autorizado: Token de Firebase ausente.'
            });
        }

        const token = authHeader.split('Bearer ')[1];

        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            // Inject user info into the request object
            (req as any).user = decodedToken;
            next();
        } catch (error) {
            console.error('Error verifying Firebase token:', error);
            return res.status(401).json({
                status: false,
                msg: 'No autorizado: Token de Firebase inválido o expirado.'
            });
        }
    };

    /**
     * Tentați validar el Firebase ID token, pero si NO existe o es inválido,
     * permite continuar (ideal para rutas mixtas Guest + Member).
     */
    public optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(); // Proceed without user injected
        }

        const token = authHeader.split('Bearer ')[1];

        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            (req as any).user = decodedToken;
            return next();
        } catch (error) {
            // Ignore token issues since this is optional Auth (guest fallback)
            return next();
        }
    };
}
