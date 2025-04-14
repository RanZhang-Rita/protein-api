function predictSecondaryStructure(sequence) {
    return sequence.split('').map(() => ['H', 'E', 'C'][Math.floor(Math.random() * 3)]).join('');
  }
  
  function identifyMotifs(sequence) {
    const motifs = [];
  
    const patterns = [
      { type: 'N-glycosylation', regex: /N[^P][ST][^P]/g },
      { type: 'Casein kinase II', regex: /[ST].{2}[DE]/g },
      { type: 'Tyrosine kinase', regex: /[RK].{0,2}[DE]/g },
    ];
  
    for (const { type, regex } of patterns) {
      let match;
      while ((match = regex.exec(sequence)) !== null) {
        motifs.push({
          motif_pattern: match[0],
          motif_type: type,
          start_position: match.index,
          end_position: match.index + match[0].length - 1,
          confidence_score: Math.random().toFixed(2)
        });
      }
    }
  
    return motifs;
  }
  
  module.exports = {
    fragmentSequence: (proteinId, sequence) => {
      const windowSize = 15;
      const stepSize = 5;
      const fragments = [];
  
      for (let i = 0; i <= sequence.length - windowSize; i += stepSize) {
        const frag = sequence.slice(i, i + windowSize);
        fragments.push({
          sequence: frag,
          start_position: i + 1,
          end_position: i + windowSize,
          secondary_structure: predictSecondaryStructure(frag),
          motifs: identifyMotifs(frag)
        });
      }
  
      return fragments;
    }
  };
  