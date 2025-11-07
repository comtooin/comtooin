import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig: any = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
};

// For Google Cloud SQL, the host is the path to the Unix socket
if (process.env.INSTANCE_CONNECTION_NAME) {
  dbConfig.host = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
} else {
  // For local development, use TCP connection
  dbConfig.host = process.env.DB_HOST;
  dbConfig.port = Number(process.env.DB_PORT);
}

const pool = new Pool(dbConfig);

export default pool;