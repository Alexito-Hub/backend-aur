// Generated from Schema/schema.graphql - do not edit manually

const typeDefs = `

schema {
  query: Query
}

type Collection {
  settings: Settings
  users: [User]
  webserver: WebServer
}

type Query {
  collection: Collection
}

type Settings {
  logger: String
  maintenance: Boolean
}

type User {
  email: String
  id: ID
  username: String
}

type WebServer {
  author: String
  description: String
  license: String
  name: String
  port: String
  protocol: String
  url: String
  version: String
}
`;

module.exports = typeDefs;
module.exports.typeDefs = typeDefs;
