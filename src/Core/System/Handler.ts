import path from 'path';
import Loader from './Loader';
import Config from './Config';
import Func from '../Utils/Utils';
import express, { Request, Response, NextFunction, Router, Application } from 'express';
import { Server } from 'socket.io';
import { WebSocketServer } from 'ws';
import WSDispatcher from '../../WebSocket/Dispatcher';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { unwrapResolverError } from '@apollo/server/errors';
import Flags from './Flags';
import logger from '../Logger/Log';
import typeDefs from '../../GraphQL/Schema';
import Cache from './Cache';
import MongoDB from '../Database/MongoDB';

export default new class Handler {
    public router: Router = express.Router()

    public async routes(): Promise<Router | undefined> {
        try {
            await Loader.router(path.join(__dirname, '../../Routes'));
            const routers = Object.values(Loader.plugins);
            routers.forEach((v: any) => {
                const route = v

                if (!route || !route.name || !route.path || !route.method || !route.execution) {
                    return
                }

                if (!Flags.isEnabled(route.name, route.enabled)) {
                    logger.info({ route: route.name }, 'Route disabled by feature flag — skipping');
                    return;
                }

                if (route.name) Config.routes.push({
                    category: Func.ucword(route.category),
                    base_code: Buffer.from(route.category.toLowerCase()).toString('base64'),
                    name: route.name,
                    path: route.example ? `${route.path}?${new URLSearchParams(Object.entries(route.example)).toString()}` : route.path,
                    method: route.method.toUpperCase(),
                    raw: {
                        path: route.path,
                        example: route.example || null
                    },
                    error: route.error,
                    premium: route.premium,
                    logger: route.logger || false
                });

                const error = (route.error ? (req: Request, res: Response, next: NextFunction) => {
                    res.json({
                        creator: process.env.WEBSERVER_AUTHOR,
                        status: false,
                        msg: `Sorry, this feature is currently error and will be fixed soon`
                    });
                } : (req: Request, res: Response, next: NextFunction) => {
                    next()
                })

                const requires = (!route.requires ? (req: Request, res: Response, next: NextFunction) => {
                    const reqFn = route.method === 'get' ? 'reqGet' : 'reqPost';
                    const check = Config.status[reqFn](req, route.parameter);
                    if (!check.status) return res.json(check);
                    const reqType = route.method === 'get' ? 'query' : 'body';
                    if ('url' in req[reqType]) {
                        const isUrl = Config.status.url(req[reqType].url);
                        if (!isUrl.status)
                            return res.json(isUrl);
                        next();
                    } else next();
                } : route.requires);

                const rawValidator = route.validator
                    ? route.validator
                    : (req: Request, res: Response, next: NextFunction) => { next(); };
                const validators: Array<(req: Request, res: Response, next: NextFunction) => void> =
                    Array.isArray(rawValidator) ? rawValidator : [rawValidator];

                if (typeof (this.router as any)[route.method] === 'function') {
                    (this.router as any)[route.method.toLowerCase()](route.path, error, requires, ...validators, route.execution);
                }
            })
            return this.router
        } catch (err) {
            if (err instanceof Error) {
                throw new Error(`Failed to load routers: ${err.message}`)
            }
        }
    }

    public async sockets(io: Server): Promise<void> {
        try {
            await Loader.socket(path.join(__dirname, '../../Socket'));
            const sockets = Object.values(Loader.sockets);

            sockets.forEach((data: any) => {
                if (typeof data.init === 'function') {
                    data.init(io);
                    logger.info({ socket: data.name }, 'Socket io injected');
                }
            });

            io.on('connection', (socket) => {
                sockets.forEach((data: any) => {
                    if (!Flags.isEnabled(data.name, data.enabled)) {
                        logger.info({ socket: data.name }, 'Socket disabled by feature flag — skipping');
                        return;
                    }

                    if (data.name) {
                        Config.sockets.push?.({
                            name: data.name,
                            description: data.description,
                            events: data.events || [],
                            file: data.file
                        });
                    }

                    if (typeof data.execution === 'function') {
                        data.execution(socket);
                    }
                });

                socket.on('disconnect', () => { })
            });
        } catch (err) {
            if (err instanceof Error) {
                throw new Error(`Failed to load sockets: ${err.message}`);
            }
        }
    };

    public async websockets(wss: WebSocketServer): Promise<void> {
        try {
            await Loader.websocketPure(path.join(__dirname, '../../WebSocket/Handlers'));
            const modules = Object.values(Loader.websockets);
            WSDispatcher.init(wss, modules);
            logger.info('Pure WebSockets initialized successfully');
        } catch (err) {
            if (err instanceof Error) {
                throw new Error(`Failed to load pure websockets: ${err.message}`);
            }
        }
    }

    public async graphql(app: Application, sqliteDb?: any): Promise<void> {
        try {
            await Loader.resolver(path.join(__dirname, '../../GraphQL/Resolvers'));

            // ─── FIX: deep merge instead of shallow Object.assign spread ──────────
            // The original code did `acc[key] = { ...acc[key], ...curr[key] }` which
            // correctly merges top-level resolver maps (Query, Mutation…) but silently
            // drops individual resolvers when two files export the same root key.
            // The deep merge below concatenates individual field resolvers safely.
            const resolvers = Loader.resolvers.reduce<Record<string, Record<string, any>>>(
                (acc, curr) => {
                    for (const rootKey of Object.keys(curr)) {
                        if (!acc[rootKey]) {
                            acc[rootKey] = {};
                        }
                        for (const fieldKey of Object.keys(curr[rootKey])) {
                            if (acc[rootKey][fieldKey]) {
                                logger.warn(
                                    { rootKey, fieldKey },
                                    'GraphQL resolver collision detected — last-writer wins. ' +
                                    'Check for duplicate field names across resolver files.',
                                );
                            }
                            acc[rootKey][fieldKey] = curr[rootKey][fieldKey];
                        }
                    }
                    return acc;
                },
                {},
            );

            // Populate Config.graphql for the /info endpoint
            Loader.resolvers.forEach((resolver: any) => {
                if (resolver.Query) {
                    Object.keys(resolver.Query).forEach(name => {
                        Config.graphql.queries.push({ name, type: 'Query' });
                    });
                }
                if (resolver.Mutation) {
                    Object.keys(resolver.Mutation).forEach(name => {
                        Config.graphql.mutations.push({ name, type: 'Mutation' });
                    });
                }
            });

            logger.info('GraphQL context: Firestore removed by Auralix Hub architecture');

            const server = new ApolloServer({
                typeDefs,
                resolvers,
                introspection: process.env.NODE_ENV !== 'production',

                // ─── Production-safe error formatter ──────────────────────────────
                // Strips stack traces and internal details before sending to clients.
                // Unexpected errors are logged server-side with full context.
                formatError: (formattedError, error) => {
                    const original = unwrapResolverError(error);

                    // Always log the real error internally
                    if (!(original instanceof Error && original.message === formattedError.message)) {
                        logger.error({ gqlError: original }, 'GraphQL unexpected resolver error');
                    }

                    if (process.env.NODE_ENV === 'production') {
                        // Preserve user-facing validation / not-found messages
                        const isSafe =
                            formattedError.extensions?.code === 'BAD_USER_INPUT' ||
                            formattedError.extensions?.code === 'GRAPHQL_VALIDATION_FAILED' ||
                            formattedError.extensions?.code === 'NOT_FOUND';

                        if (!isSafe) {
                            return {
                                message: 'Error interno del servidor. Inténtalo de nuevo.',
                                extensions: { code: 'INTERNAL_SERVER_ERROR' },
                            };
                        }
                    }

                    // In development return the full error (including stacktrace if present)
                    return formattedError;
                },
            });

            await server.start();

            app.use('/graphql', expressMiddleware(server, {
                context: async ({ req }: any) => ({
                    req,
                    user:      (req as any).user ?? null,
                    cache:     Cache,
                    mongo:     await MongoDB.init(),
                    db:        sqliteDb ?? null,

                })
            }) as any);

            logger.info('GraphQL Server initialized at /graphql');
        } catch (err) {
            if (err instanceof Error) {
                throw new Error(`Failed to initialize GraphQL: ${err.message}`);
            }
        }
    }
}