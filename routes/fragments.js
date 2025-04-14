const express = require('express');
const router = express.Router();

router.get('/:fragmentId', async (req, res) => {
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
    console.error('GET /api/fragments/:id error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
