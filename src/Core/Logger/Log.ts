import pino from 'pino';

export interface ILogger {
    level: string
    child(obj: Record<string, unknown>): ILogger
    trace(obj: unknown, msg?: string): void
    debug(obj: unknown, msg?: string): void
    info(obj: unknown, msg?: string): void
    warn(obj: unknown, msg?: string): void
    error(obj: unknown, msg?: string): void
}

const Level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');

export default pino({
    level: Level,
    timestamp: () => `,"time":"${new Date().toISOString()}"`
});