import { GraphQLContext } from '../../Core/Types/GraphQL';

export default {
    Query: {
        collection: (_: any, __: any, ctx: GraphQLContext) => ({
            users: ctx.db?.data.users ?? [],
            webserver: ctx.db?.data.webserver ?? {
                url:         process.env.WEBSERVER_URL,
                port:        process.env.WEBSERVER_PORT,
                protocol:    process.env.WEBSERVER_PROTOCOL,
                name:        process.env.WEBSERVER_NAME,
                version:     process.env.WEBSERVER_VERSION,
                description: process.env.WEBSERVER_DESCRIPTION,
                author:      process.env.WEBSERVER_AUTHOR,
                license:     process.env.WEBSERVER_LICENSE,
            },
            settings: ctx.db?.data.settings ?? {
                maintenance: false,
                logger:      'pino'
            }
        })
    }
};