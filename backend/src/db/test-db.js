
import 'dotenv/config';
import pool from './pool.js';

try {
  const [rows] = await pool.query('SELECT DATABASE() AS db, 1 AS test');
  console.log('MySQL connected successfully!');
  console.log(rows[0]);
} catch (error) {
  console.error('MySQL connection failed:', error.message);
} finally {
  await pool.end();
}
