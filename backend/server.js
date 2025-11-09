// Simple backend server with SQLite and Express
// Supports any SQL query via /query endpoint, returns JSON

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();

// Enable CORS for frontend requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const path = require('path');

// Change to your database file path
const DB_PATH = path.join(__dirname, 'observations.db');
const db = new sqlite3.Database(DB_PATH);

app.use(express.json());

// POST /query { sql: "SELECT * FROM observations WHERE ..." }
app.post('/query', (req, res) => {
  const { sql } = req.body;
  console.log('Received SQL Query:', sql);
  if (!sql) return res.status(400).json({ error: 'Missing SQL statement' });
  // Only allow SELECT statements for safety
  if (!/^\s*SELECT/i.test(sql)) return res.status(403).json({ error: 'Only SELECT statements are allowed' });
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
    console.log('Query Result:', rows.length);
  });
});

app.listen(3001, () => {
  console.log('Backend server running on port 3001');
});
