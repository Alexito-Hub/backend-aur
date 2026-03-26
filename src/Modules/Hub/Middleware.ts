import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import limit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { HubUser } from './Models';

export const hubAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies?.hub_token || req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ status: false, msg: 'No autorizado' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string };
        const user = await HubUser.findById(decoded.userId);
        
        if (!user) return res.status(401).json({ status: false, msg: 'Usuario no encontrado' });
        
        (req as any).hubUser = user;
        next();
    } catch (e) {
        return res.status(401).json({ status: false, msg: 'Token inválido o expirado' });
    }
};

export const authLimiter = limit({
    windowMs: 60 * 1000,
    max: 10,
    message: { status: false, msg: 'Demasiados intentos, intenta en 1 minuto.' },
    standardHeaders: true, legacyHeaders: false, validate: { trustProxy: false }
});

export const captchaLimiter = limit({
    windowMs: 60 * 1000,
    max: 20,
    message: { status: false, msg: 'Demasiados captchas solicitados.' },
    standardHeaders: true, legacyHeaders: false, validate: { trustProxy: false }
});

export const sandboxLimiter = limit({
    windowMs: 60 * 1000,
    max: 30,
    message: { status: false, msg: 'Límite de la sandbox excedido (30 req/min).' },
    standardHeaders: true, legacyHeaders: false, validate: { trustProxy: false }
});

export const uploadLimiter = limit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { status: false, msg: 'Límite de subida de fotos (10/hora).' },
    standardHeaders: true, legacyHeaders: false, validate: { trustProxy: false }
});

const uploadDir = path.join(__dirname, '../../../Storage/uploads/avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const userId = (req as any).hubUser?._id?.toString() || 'unknown';
        const ext = path.extname(file.originalname);
        cb(null, `${userId}-${Date.now()}${ext}`);
    }
});
export const avatarUploadMiddleware = multer({
    storage: avatarStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo se permiten imágenes'));
        cb(null, true);
    }
});
