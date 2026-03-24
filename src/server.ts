import ip from 'request-ip';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import crypto from 'crypto';
import limit from 'express-rate-limit';
import CFonts from 'cfonts';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import Create from './Core/System/Handler';
import Cache from './Core/System/Cache';
import Storage from './Core/Storage/Storage';
import MongoDB from './Core/Database/MongoDB';
import SQLite from './Core/Database/SQLite';
import Guard from './Core/Middleware/Guard';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || process.env.WEBSERVER_PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_CLOUD_RUN = process.env.K_SERVICE !== undefined;

const origins = [
    process.env.FRONTEND_URL,
    process.env.CLOUD_RUN_URL,
    /^https:\/\/(?:.*\.)?auralixpe\.xyz$/,
    /^http:\/\/localhost:\d+$/,
    /^https:\/\/.*\.run\.app$/,
].filter((o): o is string | RegExp => Boolean(o));

const io = new SocketIOServer(server, {
    cors: {
        origin: origins,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    }
})

const run = async () => {
    const [, , sqlite] = await Promise.all([
        MongoDB.init(),
        Storage.init(),
        SQLite.init({
            path: './Storage/database.db',
            needProfiling: true
        })
    ]);

    morgan.token('clientIp', (req) => (req as any).clientIp);
    app.set('json spaces', 2)
        .disable('x-powered-by')
        .set('trust proxy', true)
        .use(ip.mw())
        .use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", 'data:', 'https:'],
                    connectSrc: ["'self'", 'https://*.firebaseio.com', 'https://*.googleapis.com']
                }
            },
            crossOriginResourcePolicy: { policy: "cross-origin" },
            crossOriginEmbedderPolicy: false,
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            },
            frameguard: { action: 'deny' },
            noSniff: true,
            xssFilter: true,
            referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
        }))
        .use(cors({
            origin: origins,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-app-token', 'x-device-fingerprint'],
            exposedHeaders: ['X-Total-Count'],
            maxAge: 600
        }))
        .use(limit({
            windowMs: 5 * 60 * 1000,
            max: IS_PRODUCTION ? 100 : 500,
            message: { status: false, msg: 'Demasiadas peticiones a la API. Intenta más tarde.' },
            standardHeaders: true,
            legacyHeaders: false,
            validate: { trustProxy: false },
        }))
        .use(cookieParser())
        .use(express.json({
            limit: '10mb',
            strict: true,
            type: 'application/json'
        }))
        .use(express.urlencoded({
            extended: true,
            limit: '10mb',
            parameterLimit: 1000
        }))
        .use(morgan(IS_PRODUCTION ? 'combined' : ':clientIp :method :url :status :res[content-length] - :response-time ms'))
        .use(Guard.monitor)
        .use(session({
            secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
            name: '__session',
            resave: false,
            saveUninitialized: false,
            store: IS_PRODUCTION ? MongoStore.create({
                mongoUrl: process.env.MONGODB_URL,
                dbName: process.env.MONGODB_DB_NAME || 'sessions',
                collectionName: 'sessions',
                ttl: 7 * 24 * 60 * 60,
                autoRemove: 'native',
                touchAfter: 24 * 3600
            }) : undefined,
            proxy: true,
            cookie: {
                secure: IS_PRODUCTION,
                httpOnly: true,
                sameSite: IS_PRODUCTION ? 'none' : 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000,
                domain: process.env.COOKIE_DOMAIN || undefined,
                path: '/'
            }
        }))
        .use((req, res, next) => {
            res.setHeader('X-Powered-By', 'NXR-SERVER');
            next();
        })
        .get('/health', (req, res) => {
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: IS_PRODUCTION ? 'production' : 'development'
            });
        })
        .use('/uploads', express.static(path.join(__dirname, '../Storage/uploads')));

    await Create.graphql(app, sqlite);

    app.use('/', (await Create.routes()) ?? express.Router())
        .use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
            console.error('Error:', err);
            res.status(err.status || 500).json({
                status: false,
                msg: IS_PRODUCTION ? 'Error en el servidor' : err.message
            });
        });

    await Create.sockets(io);

    setInterval(() => Cache.sweep(), 10 * 60 * 1000);

    server.listen(PORT, '0.0.0.0' as any, () => {
        if (!IS_PRODUCTION) {
            CFonts.say('Web Server', {
                font: 'tiny',
                align: 'center',
                colors: ['system']
            });
            CFonts.say(`MongoDB, SQLite & Storage connected\nServer listening on port ---> ${PORT}`, {
                font: 'console',
                align: 'center',
                colors: ['system']
            });
        } else {
            console.log(`Server running on port ${PORT} in ${IS_CLOUD_RUN ? 'Cloud Run' : 'production'} mode`);
        }
    });
}

run().catch((err) => {
    console.error('Error al iniciar el servidor:', err);
    process.exit(1);
});