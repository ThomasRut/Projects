javascript
const { ChromaClient } = require('chromadb');

class VectorDBService {
  constructor() {
    this.client = new ChromaClient();
    this.collectionName = 'code_chunks';
    this.collection = null;
  }

  async initialize() {
    try {
      // Try to get existing collection or create new one
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: { description: 'Code chunks for test generation' }
      });
      console.log('ChromaDB initialized successfully');
    } catch (error) {
      console.error('Error initializing ChromaDB:', error);
      throw error;
    }
  }

  async addCodeChunks(chunks, embeddings) {
    try {
      const ids = chunks.map((_, idx) => `chunk_${Date.now()}_${idx}`);
      const documents = chunks.map(chunk => chunk.code);
      const metadatas = chunks.map(chunk => ({
        filePath: chunk.filePath,
        fileName: chunk.fileName,
        language: chunk.language,
        chunkType: chunk.type, // 'function', 'class', 'file'
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        functionName: chunk.functionName || ''
      }));

      await this.collection.add({
        ids,
        embeddings,
        documents,
        metadatas
      });

      return { success: true, count: chunks.length };
    } catch (error) {
      console.error('Error adding code chunks:', error);
      throw error;
    }
  }

  async searchSimilarCode(queryEmbedding, limit = 5) {
    try {
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit
      });

      return results.documents[0].map((doc, idx) => ({
        code: doc,
        metadata: results.metadatas[0][idx],
        distance: results.distances[0][idx]
      }));
    } catch (error) {
      console.error('Error searching vector DB:', error);
      throw error;
    }
  }

  async searchByFileName(fileName, limit = 10) {
    try {
      const results = await this.collection.get({
        where: { fileName: fileName },
        limit: limit
      });

      return results.documents.map((doc, idx) => ({
        code: doc,
        metadata: results.metadatas[idx]
      }));
    } catch (error) {
      console.error('Error searching by filename:', error);
      throw error;
    }
  }

  async clearCollection() {
    try {
      await this.client.deleteCollection({ name: this.collectionName });
      await this.initialize();
      return { success: true };
    } catch (error) {
      console.error('Error clearing collection:', error);
      throw error;
    }
  }
}

module.exports = new VectorDBService();