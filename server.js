require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const proteinsRouter = require('./routes/proteins');
const authenticateUser = require('./middleware/auth');
const qs = require('qs');

const app = express();

app.set('query parser', str => qs.parse(str));

app.use(express.json());

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD
});
app.locals.pool = pool;

app.use('/api', authenticateUser);
app.use('/api/proteins', proteinsRouter);

const fragmentsRouter = require('./routes/fragments'); 

app.use('/api/fragments', fragmentsRouter); 


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
