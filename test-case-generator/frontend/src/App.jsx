import { useState } from 'react';
import FileUpload from './components/FileUpload';
import TestGenerator from './components/TestGenerator';
import './App.css';

function App() {
  const [uploadStatus, setUploadStatus] = useState(null);

  return (
    <div className="App">
      <header>
        <h1>AI Test Case Generator</h1>
        <p>Upload your codebase and generate comprehensive tests</p>
      </header>

      <main>
        <section className="upload-section">
          <h2>Step 1: Upload Code</h2>
          <FileUpload onUploadComplete={setUploadStatus} />
          {uploadStatus && (
            <div className="status-message">
              ✓ {uploadStatus.filesProcessed} files processed, {uploadStatus.chunksCreated} code chunks indexed
            </div>
          )}
        </section>

        <section className="generate-section">
          <h2>Step 2: Generate Tests</h2>
          <TestGenerator />
        </section>
      </main>
    </div>
  );
}

export default App;