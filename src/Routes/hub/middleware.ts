import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { HubUser } from '../../Modules/Hub/Models';

const JWT_SECRET = process.env.JWT_SECRET || 'hub_dev_secret_change_me';

export async function hubAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ status: false, msg: 'Token requerido' });
    }

    const token = auth.slice(7);
    try {
        const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
        const user = await HubUser.findById(payload.sub);
        if (!user) return res.status(401).json({ status: false, msg: 'Usuario no encontrado' });
        (req as any).hubUser = user;
        next();
    } catch {
        return res.status(401).json({ status: false, msg: 'Token inválido o expirado' });
    }
}
