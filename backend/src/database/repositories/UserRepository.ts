import { dbPool } from '../index.js';
import { PoolClient } from 'pg';

export interface User {
  id: string;
  wallet_address: string;
  email: string | null;
  name: string | null;
  c_address: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
}

export class UserRepository {
  static async findById(id: string, client?: PoolClient): Promise<User | null> {
    const db = client || dbPool;
    const result = await db.query<User>('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findByWallet(walletAddress: string, client?: PoolClient): Promise<User | null> {
    const db = client || dbPool;
    const result = await db.query<User>('SELECT * FROM users WHERE wallet_address = $1', [walletAddress]);
    return result.rows[0] || null;
  }

  static async upsertByWallet(walletAddress: string, client?: PoolClient): Promise<User> {
    const db = client || dbPool;
    const query = `
      INSERT INTO users (wallet_address, last_login)
      VALUES ($1, NOW())
      ON CONFLICT (wallet_address) 
      DO UPDATE SET last_login = NOW()
      RETURNING *
    `;
    const result = await db.query<User>(query, [walletAddress]);
    return result.rows[0] as User;
  }

  static async create(user: Partial<User>, client?: PoolClient): Promise<User> {
    const db = client || dbPool;
    const query = `
      INSERT INTO users (wallet_address, email, name, c_address)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [user.wallet_address, user.email || null, user.name || null, user.c_address || null];
    const result = await db.query<User>(query, values);
    return result.rows[0] as User;
  }

  static async update(id: string, updates: Partial<User>, client?: PoolClient): Promise<User | null> {
    const db = client || dbPool;
    
    const setClauses: string[] = [];
    const values: any[] = [];
    let argCounter = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['wallet_address', 'email', 'name', 'c_address', 'is_active', 'last_login'].includes(key)) {
        setClauses.push(`${key} = $${argCounter}`);
        values.push(value);
        argCounter++;
      }
    }

    if (setClauses.length === 0) return this.findById(id, client);

    values.push(id);
    const query = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${argCounter}
      RETURNING *
    `;

    const result = await db.query<User>(query, values);
    return result.rows[0] || null;
  }
}
