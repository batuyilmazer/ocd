import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [currentJob, setCurrentJob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSingleClickDownload = async () => {
    setIsLoading(true);
    
    try {
      // Step 1: Read clipboard
      let url = '';
      try {
        url = await navigator.clipboard.readText();
      } catch (error) {
        console.log('Could not read clipboard:', error);
        alert('Lütfen önce bir YouTube URL\'si kopyalayın, sonra tekrar deneyin.');
        setIsLoading(false);
        return;
      }

      // Step 2: Validate YouTube URL
      if (!url || !isValidYouTubeUrl(url)) {
        alert('Kopyalanan metin geçerli bir YouTube URL\'si değil. Lütfen bir YouTube URL\'si kopyalayın.');
        setIsLoading(false);
        return;
      }

      // Step 3: Start download
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'İndirme başlatılamadı');
      }

      const data = await response.json();
      setCurrentJob({
        id: data.job_id,
        status: 'queued',
        progress: 0
      });

      alert('İndirme başladı! Dosya hazır olduğunda otomatik olarak indirilecek.');

    } catch (error) {
      alert('Hata: ' + (error instanceof Error ? error.message : 'İndirme başlatılamadı'));
      console.error('Download error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isValidYouTubeUrl = (url) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]+/;
    return youtubeRegex.test(url);
  };

  const pollJobStatus = async (jobId) => {
    try {
      const response = await fetch(`/api/status/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentJob(prev => prev ? {
          ...prev,
          status: data.status,
          progress: data.progress || 0,
          filename: data.filename,
          error: data.error,
        } : null);
      }
    } catch (error) {
      console.error('Status polling error:', error);
    }
  };

  useEffect(() => {
    if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed') {
      return;
    }

    const interval = setInterval(() => {
      pollJobStatus(currentJob.id);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentJob]);

  // Auto-download when job completes
  useEffect(() => {
    if (currentJob && currentJob.status === 'completed' && currentJob.filename) {
      // Auto-download the file
      const downloadUrl = `/files/${currentJob.filename}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = currentJob.filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clear the job after successful download
      setTimeout(() => {
        setCurrentJob(null);
      }, 2000);
    }
  }, [currentJob]);

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Tamamlandı - Dosya İndiriliyor';
      case 'downloading': return 'İndiriliyor';
      case 'queued': return 'Sırada';
      case 'failed': return 'Başarısız';
      default: return 'Bilinmiyor';
    }
  };

  return (
    <div className="App">
      <div className="viewport">
        {/* Main Circular Button */}
        <div className="main-button-container">
          <button
            className={`circular-button ${isLoading ? 'disabled' : ''}`}
            onClick={handleSingleClickDownload}
            disabled={isLoading}
          >
            <div className="button-content">
              <div className="button-icon">
                📋
              </div>
            </div>
            <div className="button-glow" />
          </button>
        </div>
      </div>

      {/* Job Status Panel */}
      {currentJob && (
        <div className="job-panel">
          <div className="job-header">
            <h2>İndirme Durumu</h2>
          </div>
          <div className="job-content">
            <div className="job-status">{getStatusText(currentJob.status)}</div>
            
            {currentJob.status === 'downloading' && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${currentJob.progress}%` }}
                  ></div>
                </div>
                <div className="progress-text">{Math.round(currentJob.progress)}%</div>
              </div>
            )}
            
            {currentJob.status === 'completed' && currentJob.filename && (
              <div className="completed-container">
                <div className="filename">{currentJob.filename}</div>
                <div className="success-message">✅ Dosya başarıyla indirildi!</div>
              </div>
            )}
            
            {currentJob.status === 'failed' && currentJob.error && (
              <div className="error-container">
                <div className="error-text">❌ Hata: {currentJob.error}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
