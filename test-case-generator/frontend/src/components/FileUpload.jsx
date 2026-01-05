import { useState } from 'react';
import { uploadFiles, clearDatabase } from '../services/api';

function FileUpload({ onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleFileSelect = (e) => {
    setSelectedFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      const result = await uploadFiles(selectedFiles);
      onUploadComplete(result);
      setSelectedFiles([]);
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear all uploaded code from database?')) return;
    
    try {
      await clearDatabase();
      onUploadComplete(null);
      alert('Database cleared successfully');
    } catch (error) {
      alert('Clear failed: ' + error.message);
    }
  };

  return (
    <div className="file-upload">
      <input
        type="file"
        multiple
        accept=".js,.jsx,.ts,.tsx,.java,.py,.cs"
        onChange={handleFileSelect}
        disabled={uploading}
      />
      
      {selectedFiles.length > 0 && (
        <div className="selected-files">
          <p>{selectedFiles.length} file(s) selected:</p>
          <ul>
            {selectedFiles.map((file, idx) => (
              <li key={idx}>{file.name}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="button-group">
        <button 
          onClick={handleUpload} 
          disabled={uploading || selectedFiles.length === 0}
        >
          {uploading ? 'Uploading...' : 'Upload & Process'}
        </button>
        
        <button 
          onClick={handleClear}
          className="clear-btn"
        >
          Clear Database
        </button>
      </div>
    </div>
  );
}

export default FileUpload;