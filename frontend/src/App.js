import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [currentJob, setCurrentJob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const readClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && isValidYouTubeUrl(text)) {
        setUrl(text);
      }
    } catch (error) {
      console.log('Could not read clipboard:', error);
    }
  };

  const isValidYouTubeUrl = (url) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]+/;
    return youtubeRegex.test(url);
  };

  const startDownload = async () => {
    if (!url.trim()) {
      alert('Lütfen bir YouTube URL\'si girin');
      return;
    }
    if (!isValidYouTubeUrl(url)) {
      alert('Lütfen geçerli bir YouTube URL\'si girin');
      return;
    }

    setIsLoading(true);
    try {
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
      setUrl('');
      alert('Başarılı', 'İndirme başladı!');
    } catch (error) {
      alert('Hata', error instanceof Error ? error.message : 'İndirme başlatılamadı');
      console.error('Download error:', error);
    } finally {
      setIsLoading(false);
    }
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

  const getDownloadLink = (filename) => {
    return `/files/${filename}`;
  };

  const handleDownload = (filename) => {
    try {
      const downloadUrl = getDownloadLink(filename);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      window.open(getDownloadLink(filename), '_blank');
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Tamamlandı';
      case 'downloading': return 'İndiriliyor';
      case 'queued': return 'Sırada';
      case 'failed': return 'Başarısız';
      default: return 'Bilinmiyor';
    }
  };

  return (
    <div className="App">
      <div className="header">
        <h1>YouTube İndirici</h1>
      </div>
      
      <div className="input-container">
        <input
          type="text"
          className="input"
          placeholder="YouTube URL'sini buraya yapıştırın..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="paste-button" onClick={readClipboard}>
          Yapıştır
        </button>
      </div>
      
      <button
        className={`download-button ${isLoading ? 'disabled' : ''}`}
        onClick={startDownload}
        disabled={isLoading}
      >
        {isLoading ? 'İşleniyor...' : 'İndir'}
      </button>
      
      {currentJob && (
        <div className="job-container">
          <h2>İndirme Durumu</h2>
          <div className="job-card">
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
                <button 
                  className="download-link"
                  onClick={() => handleDownload(currentJob.filename)}
                >
                  Dosyayı İndir
                </button>
              </div>
            )}
            
            {currentJob.status === 'failed' && currentJob.error && (
              <div className="error-container">
                <div className="error-text">Hata: {currentJob.error}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
