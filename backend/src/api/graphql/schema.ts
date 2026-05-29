export const typeDefs = `#graphql
  type User {
    id: ID!
    wallet_address: String!
    email: String
    name: String
    is_active: Boolean!
    created_at: String!
    last_login: String
  }

  type Merchant {
    id: ID!
    wallet_address: String!
    business_name: String!
    business_email: String
    business_url: String
    logo_url: String
    kyc_status: String!
    country_code: String
    is_active: Boolean!
    created_at: String!
  }

  type Plan {
    id: ID!
    plan_id_on_chain: String!
    merchant_id: ID!
    name: String!
    description: String
    amount: String!
    token_address: String!
    interval_seconds: Int!
    max_payments: Int!
    is_active: Boolean!
    subscriber_count: Int!
    created_at: String!
  }

  type Subscription {
    id: ID!
    subscription_id_on_chain: String!
    user_id: ID!
    plan_id: ID!
    merchant_id: ID!
    status: String!
    start_time: String!
    next_payment_time: String!
    payments_made: Int!
    created_at: String!
    plan: Plan
    merchant: Merchant
  }

  type Query {
    me: User
    mySubscriptions: [Subscription!]!
    merchant(id: ID!): Merchant
    merchantPlans(merchantId: ID!): [Plan!]!
    plan(id: ID!): Plan
  }

  type Mutation {
    cancelSubscription(id: ID!): Subscription
  }
`;
