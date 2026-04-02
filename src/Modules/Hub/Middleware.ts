import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import limit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { HubUser } from './Models';

const SNIPPET_MAX_BYTES = 200000;
const SNIPPET_ALLOWED_EXTENSIONS = new Set([
    '.txt', '.md', '.json', '.yaml', '.yml', '.xml', '.csv', '.ini', '.toml',
    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.dart', '.py', '.rb', '.php',
    '.java', '.kt', '.swift', '.go', '.rs', '.scala', '.sql', '.sh', '.bash',
    '.zsh', '.ps1', '.c', '.cpp', '.h', '.hpp', '.cs', '.css', '.html', '.graphql',
]);

const SNIPPET_ALLOWED_MIME = new Set([
    'text/plain',
    'text/markdown',
    'application/json',
    'application/xml',
    'application/javascript',
    'application/x-javascript',
    'application/typescript',
    'application/x-typescript',
    'application/x-sh',
    'application/x-shellscript',
    'application/x-httpd-php',
    'application/x-yaml',
    'application/yaml',
]);

function isAllowedSnippetUpload(file: Express.Multer.File): boolean {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();

    if (SNIPPET_ALLOWED_EXTENSIONS.has(ext)) return true;
    if (mime.startsWith('text/')) return true;
    if (SNIPPET_ALLOWED_MIME.has(mime)) return true;

    return false;
}

function getDeviceFingerprint(req: Request): string {
    const raw = req.headers['x-device-fingerprint'];
    const fingerprint = Array.isArray(raw) ? raw[0] : raw;
    if (typeof fingerprint !== 'string') return 'missing';
    return fingerprint.trim().slice(0, 128) || 'missing';
}

function riskKey(req: Request): string {
    const ip = String((req as any).clientIp || req.ip || '0.0.0.0').trim();
    const fingerprint = getDeviceFingerprint(req);
    return `${ip}:${fingerprint}`;
}

export const requireDeviceFingerprint = (req: Request, res: Response, next: NextFunction) => {
    const fingerprint = getDeviceFingerprint(req);
    if (fingerprint === 'missing' || fingerprint.length < 16) {
        return res.status(400).json({ status: false, msg: 'Fingerprint de dispositivo requerido' });
    }
    next();
};

export const hubAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies?.hub_token || req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ status: false, msg: 'No autorizado' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
            userId?: string;
            sub?: string;
        };
        const userId = decoded.userId || decoded.sub;
        if (!userId) return res.status(401).json({ status: false, msg: 'Token inválido o expirado' });
        const user = await HubUser.findById(userId);
        
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

export const authFraudLimiter = limit({
    windowMs: 10 * 60 * 1000,
    max: 40,
    keyGenerator: (req) => riskKey(req as Request),
    message: { status: false, msg: 'Actividad sospechosa detectada. Intenta mas tarde.' },
    standardHeaders: true, legacyHeaders: false, validate: { trustProxy: false }
});

export const captchaLimiter = limit({
    windowMs: 60 * 1000,
    max: 20,
    message: { status: false, msg: 'Demasiados captchas solicitados.' },
    standardHeaders: true, legacyHeaders: false, validate: { trustProxy: false }
});

export const captchaFraudLimiter = limit({
    windowMs: 5 * 60 * 1000,
    max: 60,
    keyGenerator: (req) => riskKey(req as Request),
    message: { status: false, msg: 'Trafico de captcha limitado por seguridad.' },
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

export const snippetUploadLimiter = limit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    keyGenerator: (req) => riskKey(req as Request),
    message: { status: false, msg: 'Límite de subida de código alcanzado. Intenta nuevamente.' },
    standardHeaders: true, legacyHeaders: false, validate: { trustProxy: false }
});

export const snippetCodeUploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: SNIPPET_MAX_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (!isAllowedSnippetUpload(file)) {
            return cb(new Error('Formato de archivo no permitido para snippets'));
        }
        cb(null, true);
    },
});
