// Simple backend server with SQLite and Express
// Supports any SQL query via /query endpoint, returns JSON

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const path = require('path');

// Change to your database file path
const DB_PATH = path.join(__dirname, 'observations.db');
const db = new sqlite3.Database(DB_PATH);

app.use(express.json());

// POST /query { sql: "SELECT * FROM observations WHERE ..." }
app.post('/query', (req, res) => {
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'Missing SQL statement' });
  // Only allow SELECT statements for safety
  if (!/^\s*SELECT/i.test(sql)) return res.status(403).json({ error: 'Only SELECT statements are allowed' });
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(3001, () => {
  console.log('Backend server running on port 3001');
});
