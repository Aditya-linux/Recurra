import { ApolloServer } from '@apollo/server';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';

export interface GraphQLContext {
  user?: { id: string; walletAddress: string };
  merchant?: { id: string; walletAddress: string };
}

export const apolloServer = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  formatError: (formattedError, _error) => {
    // Optionally format or redact errors for security
    return formattedError;
  },
});
