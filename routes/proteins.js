const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { fragmentSequence } = require('../utils/fragmenter');

// POST /api/proteins
router.post('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const { name, description, molecularWeight, sequence } = req.body;

  if (name == null || molecularWeight == null || sequence == null)
    return res.status(400).json({ error: 'Missing required fields' });

  if (typeof name !== 'string' || name.length === 0 || name.length > 100) {
    return res.status(400).json({ error: 'Protein name must be 1–100 characters' });
  }
  
  if (typeof molecularWeight !== 'number' || molecularWeight <= 0) {
    return res.status(400).json({ error: 'Molecular weight must be a positive number' });
  }

  const MAX_PROTEIN_LENGTH = parseInt(process.env.MAX_PROTEIN_LENGTH || '2000');
  const validAminoAcidsRegex = /^[ACDEFGHIKLMNPQRSTVWY]+$/;

  if (sequence.length > MAX_PROTEIN_LENGTH) {
    return res.status(400).json({ error: `Sequence exceeds MAX_PROTEIN_LENGTH of ${MAX_PROTEIN_LENGTH}` });
  }

  if (!validAminoAcidsRegex.test(sequence)) {
    return res.status(400).json({ error: 'Sequence contains invalid amino acid characters. Only A–Z (ACDEFGHIKLMNPQRSTVWY) are allowed.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sequenceLength = sequence.length;
    const sequenceUrl = `https://dummy.local/proteins/${uuidv4()}.fasta`;

    const result = await client.query(
      `INSERT INTO proteins (name, description, molecular_weight, sequence_length, sequence_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING protein_id`,
      [name, description, molecularWeight, sequenceLength, sequenceUrl]
    );

    const proteinId = result.rows[0].protein_id;
    const fragments = fragmentSequence(proteinId, sequence);

    for (const frag of fragments) {
      const fragResult = await client.query(
        `INSERT INTO fragments (protein_id, sequence, start_position, end_position, secondary_structure, url)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING fragment_id`,
        [proteinId, frag.sequence, frag.start_position, frag.end_position, frag.secondary_structure, 'https://dummy.local/fragment']
      );

      const fragmentId = fragResult.rows[0].fragment_id;
      for (const motif of frag.motifs) {
        await client.query(
          `INSERT INTO motifs (fragment_id, motif_pattern, motif_type, start_position, end_position, confidence_score)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [fragmentId, motif.motif_pattern, motif.motif_type, motif.start_position, motif.end_position, motif.confidence_score]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Protein and fragments created', proteinId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in POST /api/proteins:', err);
  
    // PostgreSQL error code 22001 = string too long
    if (err.code === '22001') {
      return res.status(400).json({ error: 'Input too long: one of the fields exceeds allowed length' });
    }
  
    // PostgreSQL error code 23514 = check constraint violation (e.g., molecular_weight > 0)
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Constraint violation: molecular weight must be greater than 0' });
    }
  
    res.status(500).json({ error: 'Internal Server Error' });
  }
  finally {
    client.release();
  }
});

// GET /api/proteins
router.get('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const result = await pool.query(
      `SELECT * FROM proteins ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/proteins error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/proteins/fragments/:fragmentId
router.get('/fragments/:fragmentId', async (req, res) => {
  const pool = req.app.locals.pool;
  const { fragmentId } = req.params;

  try {
    const result = await pool.query(`
      SELECT f.*, 
        json_agg(m.motif_pattern) AS motifs,
        json_agg(m.confidence_score) AS confidence_scores
      FROM fragments f
      LEFT JOIN motifs m ON f.fragment_id = m.fragment_id
      WHERE f.fragment_id = $1
      GROUP BY f.fragment_id
    `, [fragmentId]);

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Fragment with the given ID does not exist' });

    const row = result.rows[0];
    res.json({
      fragmentId: row.fragment_id,
      proteinId: row.protein_id,
      sequence: row.sequence,
      startPosition: row.start_position,
      endPosition: row.end_position,
      motifs: row.motifs || [],
      confidenceScores: row.confidence_scores || [],
      secondaryStructure: row.secondary_structure,
      createdAt: row.created_at,
      url: row.url
    });
  } catch (err) {
    console.error('GET /fragments/:id error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/proteins/:proteinId/fragments
router.get('/:proteinId/fragments', async (req, res) => {
  const pool = req.app.locals.pool;
  const { proteinId } = req.params;

  try {
    const result = await pool.query(`
      SELECT f.*, 
        json_agg(m.motif_pattern) AS motifs,
        json_agg(m.confidence_score) AS confidence_scores
      FROM fragments f
      LEFT JOIN motifs m ON f.fragment_id = m.fragment_id
      WHERE f.protein_id = $1
      GROUP BY f.fragment_id
      ORDER BY f.start_position ASC
    `, [proteinId]);

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Protein or fragments not found' });

    const fragments = result.rows.map(row => ({
      fragmentId: row.fragment_id,
      proteinId: row.protein_id,
      sequence: row.sequence,
      startPosition: row.start_position,
      endPosition: row.end_position,
      motifs: row.motifs || [],
      confidenceScores: row.confidence_scores || [],
      secondaryStructure: row.secondary_structure,
      createdAt: row.created_at,
      url: row.url
    }));

    res.json(fragments);
  } catch (err) {
    console.error('GET /:id/fragments error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/proteins/search
router.get('/search', async (req, res) => {
  const pool = req.app.locals.pool;
  

  const name = req.query.name;
  const motif = req.query.motif;
  const sort = req.query.sort;

  const mwGt = req.query?.molecularWeight?.gt;
  const mwLt = req.query?.molecularWeight?.lt;
  const slGte = req.query?.sequenceLength?.gte;
  const slLte = req.query?.sequenceLength?.lte;

  const allowedTopLevelKeys = ['name', 'motif', 'sort', 'molecularWeight', 'sequenceLength'];
  const allowedRangeOperators = ['gt', 'gte', 'lt', 'lte', 'eq'];

  // Check for invalid top-level keys
  for (const key of Object.keys(req.query)) {
    if (!allowedTopLevelKeys.includes(key)) {
      return res.status(400).json({ error: `Invalid query parameter: ${key}` });
    }
  }

  // Check nested range operators for molecularWeight
  if (req.query.molecularWeight) {
    for (const op of Object.keys(req.query.molecularWeight)) {
      if (!allowedRangeOperators.includes(op)) {
        return res.status(400).json({ error: `Invalid operator in molecularWeight: ${op}` });
      }
    }
  }

  // Check nested range operators for sequenceLength
  if (req.query.sequenceLength) {
    for (const op of Object.keys(req.query.sequenceLength)) {
      if (!allowedRangeOperators.includes(op)) {
        return res.status(400).json({ error: `Invalid operator in sequenceLength: ${op}` });
      }
    }
  }


  if (motif) {
    try {
      new RegExp(motif);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid motif pattern' });
    }
  }

  const values = [];
  let sql = `SELECT DISTINCT p.* FROM proteins p `;
  if (motif) {
    sql += `INNER JOIN fragments f ON p.protein_id = f.protein_id
            INNER JOIN motifs m ON f.fragment_id = m.fragment_id `;
  }
  sql += `WHERE 1=1 `;

  if (name) {
    values.push(`%${name}%`);
    sql += `AND p.name ILIKE $${values.length} `;
  }
  if (mwGt) {
    values.push(Number(mwGt));
    sql += `AND p.molecular_weight > $${values.length} `;
  }
  if (mwLt) {
    values.push(Number(mwLt));
    sql += `AND p.molecular_weight < $${values.length} `;
  }
  if (slGte) {
    values.push(Number(slGte));
    sql += `AND p.sequence_length >= $${values.length} `;
  }
  if (slLte) {
    values.push(Number(slLte));
    sql += `AND p.sequence_length <= $${values.length} `;
  }
  if (motif) {
    values.push(motif);
    sql += `AND m.motif_pattern ~ $${values.length} `;
  }

  if (sort) {
    const [field, direction] = sort.split(':');
    const safeField = ['name', 'created_at', 'molecular_weight', 'sequence_length'].includes(field) ? field : 'name';
    const safeDir = direction === 'desc' ? 'DESC' : 'ASC';
    sql += `ORDER BY p.${safeField} ${safeDir} `;
  }

  try {
    const result = await pool.query(sql, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Search error:', err);
    res.status(400).json({ error: 'Invalid query parameters' });
  }
});

module.exports = router;
