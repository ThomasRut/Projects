const express = require('express');
const router = express.Router();
const vectorDB = require('../services/vectorDB');
const embeddingService = require('../services/embeddingService');
const testGenerator = require('../services/testGenerator');

router.post('/tests', async (req, res) => {
  try {
    const { targetCode, testType, framework, language, searchQuery } = req.body;

    await vectorDB.initialize();

    // Generate embedding for the search query (or target code)
    const query = searchQuery || targetCode;
    const queryEmbedding = await embeddingService.generateSingleEmbedding(query);

    // Retrieve relevant code context using RAG
    const relevantCode = await vectorDB.searchSimilarCode(queryEmbedding, 5);

    // Filter out the exact target code from context to avoid duplication
    const contextCode = relevantCode.filter(item => 
      !item.code.includes(targetCode.substring(0, 100))
    );

    // Generate tests using Claude
    const result = await testGenerator.generateTests(contextCode, {
      targetCode,
      testType: testType || 'unit',
      framework: framework || 'Jest',
      language: language || 'javascript'
    });

    res.json({
      success: true,
      tests: result.tests,
      contextUsed: contextCode.length,
      usage: result.usage
    });

  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;