import { readFileSync } from 'fs';
import { join } from 'path';
import { gql } from 'graphql-tag';

const path = join(process.cwd(), 'GraphQL/schema.graphql');
const typeDefs = gql(readFileSync(path, 'utf8'));

export default typeDefs;
