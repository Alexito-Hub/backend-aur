import { Server, Socket, Namespace } from "socket.io";
import logger from "../Core/Logger/Log";
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hub_dev_secret_change_me';

let _nsp: Namespace | null = null;

export function emitRequestLog(userId: string, log: any): void {
    _nsp?.to(`user:${userId}`).emit('request_log', log);
}

export function broadcastSystem(msg: string): void {
    _nsp?.emit('system', { msg, timestamp: new Date() });
}

export default {
    name: "hub",
    description: "Auralix Hub real-time streaming",
    events: ["connected", "request_log", "system"],
    file: "hub.ts",
    init(io: Server) {
        // Use a custom namespace to avoid colliding with other apps
        _nsp = io.of('/api/hub/socket');
        
        _nsp.use((socket, next) => {
            const token = socket.handshake.auth?.token as string | undefined;
            if (!token) return next(new Error('Unauthorized'));
            try {
                const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
                socket.data.userId = payload.sub;
                next();
            } catch {
                next(new Error('Invalid token'));
            }
        });

        _nsp.on('connection', (socket) => {
            const userId = socket.data.userId as string;
            socket.join(`user:${userId}`);
            socket.emit('connected', { msg: '$ connected to Auralix Hub live stream' });

            socket.on('disconnect', () => {
                socket.leave(`user:${userId}`);
            });
        });
        
        logger.info('Auralix Hub WebSocket namespace (/api/hub/socket) initialized natively');
    },
    execution(socket: Socket) {
        // Any global connection logic if needed (handled in init namespace instead)
    }
};
