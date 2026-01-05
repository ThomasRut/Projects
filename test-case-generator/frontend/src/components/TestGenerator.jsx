import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { generateTests } from '../services/api';

function TestGenerator() {
  const [targetCode, setTargetCode] = useState('');
  const [testType, setTestType] = useState('unit');
  const [framework, setFramework] = useState('Jest');
  const [language, setLanguage] = useState('javascript');
  const [generatedTests, setGeneratedTests] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!targetCode.trim()) {
      alert('Please enter code to test');
      return;
    }

    setGenerating(true);
    try {
      const result = await generateTests({
        targetCode,
        testType,
        framework,
        language
      });
      setGeneratedTests(result.tests);
    } catch (error) {
      alert('Generation failed: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedTests);
    alert('Tests copied to clipboard!');
  };

  return (
    <div className="test-generator">
      <div className="config-panel">
        <div className="form-group">
          <label>Test Type:</label>
          <select value={testType} onChange={(e) => setTestType(e.target.value)}>
            <option value="unit">Unit Tests</option>
            <option value="integration">Integration Tests</option>
          </select>
        </div>

        <div className="form-group">
          <label>Framework:</label>
          <select value={framework} onChange={(e) => setFramework(e.target.value)}>
            <option value="Jest">Jest</option>
            <option value="JUnit">JUnit</option>
            <option value="Mocha">Mocha</option>
            <option value="pytest">pytest</option>
          </select>
        </div>

        <div className="form-group">
          <label>Language:</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
            <option value="python">Python</option>
            <option value="csharp">C#</option>
          </select>
        </div>
      </div>

      <div className="editor-section">
        <h3>Code to Test:</h3>
        <Editor
          height="300px"
          language={language}
          value={targetCode}
          onChange={setTargetCode}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14
          }}
        />
      </div>

      <button 
        className="generate-btn"
        onClick={handleGenerate}
        disabled={generating}
      >
        {generating ? 'Generating Tests...' : 'Generate Tests'}
      </button>

      {generatedTests && (
        <div className="results-section">
          <div className="results-header">
            <h3>Generated Tests:</h3>
            <button onClick={handleCopy}>Copy Tests</button>
          </div>
          <Editor
            height="400px"
            language={language}
            value={generatedTests}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 14
            }}
          />
        </div>
      )}
    </div>
  );
}