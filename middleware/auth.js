module.exports = async function authenticateUser(req, res, next) {
    const userId = req.header('X-User-ID');
    if (!userId) return res.status(401).json({ error: 'Missing X-User-ID' });
  
    try {
      const pool = req.app.locals.pool;
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid user' });
  
      req.user = result.rows[0];
      next();
    } catch (err) {
      console.error('Authentication error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
  