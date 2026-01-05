class CodeChunker {
  
  chunkByFunctions(code, filePath, language) {
    const chunks = [];
    const fileName = filePath.split('/').pop();
    
    // Simple regex-based chunking (you can enhance with tree-sitter later)
    const patterns = {
      javascript: /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|class\s+\w+)[^}]*\{(?:[^{}]|\{[^}]*\})*\}/gs,
      java: /(?:public|private|protected)?\s*(?:static)?\s*(?:\w+)\s+(\w+)\s*\([^)]*\)\s*\{[^}]*\}/gs,
      python: /def\s+\w+\([^)]*\):[\s\S]*?(?=\ndef\s|\nclass\s|$)/g
    };

    const pattern = patterns[language] || patterns.javascript;
    const matches = code.matchAll(pattern);

    let chunkIndex = 0;
    for (const match of matches) {
      const functionCode = match[0];
      const functionName = this.extractFunctionName(functionCode, language);
      
      chunks.push({
        code: functionCode,
        filePath,
        fileName,
        language,
        type: 'function',
        functionName,
        startLine: this.getLineNumber(code, match.index),
        endLine: this.getLineNumber(code, match.index + functionCode.length),
        chunkIndex: chunkIndex++
      });
    }

    // If no functions found, chunk the entire file
    if (chunks.length === 0) {
      chunks.push({
        code: code,
        filePath,
        fileName,
        language,
        type: 'file',
        functionName: '',
        startLine: 1,
        endLine: code.split('\n').length,
        chunkIndex: 0
      });
    }

    return chunks;
  }

  extractFunctionName(code, language) {
    const patterns = {
      javascript: /(?:function\s+(\w+)|const\s+(\w+)\s*=|class\s+(\w+))/,
      java: /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(/,
      python: /def\s+(\w+)\s*\(/
    };

    const pattern = patterns[language] || patterns.javascript;
    const match = code.match(pattern);
    return match ? (match[1] || match[2] || match[3] || 'unknown') : 'unknown';
  }

  getLineNumber(fullCode, index) {
    return fullCode.substring(0, index).split('\n').length;
  }

  // Extract imports/dependencies from code
  extractDependencies(code, language) {
    const patterns = {
      javascript: /import\s+.*?from\s+['"](.+?)['"]/g,
      java: /import\s+([^;]+);/g,
      python: /(?:from\s+(\S+)\s+)?import\s+(.+)/g
    };

    const pattern = patterns[language];
    if (!pattern) return [];

    const deps = [];
    const matches = code.matchAll(pattern);
    for (const match of matches) {
      deps.push(match[1] || match[2]);
    }
    return deps;
  }
}

module.exports = new CodeChunker();