const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'appdb',
  connectionTimeoutMillis: 3000,
});

// Main endpoint - reads from DB to prove connectivity
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as db_time');
    res.json({
      message: 'Hello from Dhiraj'; 
      pod: process.env.HOSTNAME,
      db_time: result.rows[0].db_time,
    });
  } catch (err) {
    console.error('DB query failed:', err.message);
    res.status(500).json({ error: 'database unavailable' });
  }
});

// Liveness: is the process itself alive? Never checks DB —
// restarting the app won't fix a broken DB.
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

// Readiness: can this pod serve traffic? Checks DB connectivity,
// so a pod with a broken DB connection is pulled from the Service.
app.get('/readyz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (err) {
    console.error('Readiness check failed:', err.message);
    res.status(503).json({ status: 'not ready', reason: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
