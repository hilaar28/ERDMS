import pg from 'pg';

const { Pool } = pg;

/*
 * Shared connection pool.
 *
 * Previously each route/model created its own module-level `pg.Client` and
 * called `.connect()` / `.end()` on it per request. Because a `Client`
 * represents a single connection, concurrent requests sharing one instance
 * would race with each other (one request's `.end()` closing the connection
 * while another was still using it). A `Pool` hands each caller its own
 * connection from a pool and is the correct tool for a multi-request server.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  // Errors on idle clients (e.g. connection dropped by the DB) should not
  // crash the process.
  console.error('Unexpected PostgreSQL pool error:', err);
});

export default pool;
