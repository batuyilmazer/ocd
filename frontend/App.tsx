import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

// Version constant
const APP_VERSION = '1.0.0';

interface DownloadJob {
  id: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed';
  progress: number;
  filename?: string;
  error?: string;
}

const API_BASE = '/api';

export default function App() {
  const [url, setUrl] = useState('');
  const [currentJob, setCurrentJob] = useState<DownloadJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const readClipboard = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web: use navigator.clipboard
        const text = await navigator.clipboard.readText();
        if (text && isValidYouTubeUrl(text)) {
          setUrl(text);
        }
      } else {
        // Native: use expo-clipboard
        const { data } = await Clipboard.getStringAsync();
        if (data && isValidYouTubeUrl(data)) {
          setUrl(data);
        }
      }
    } catch (error) {
      console.log('Could not read clipboard:', error);
    }
  };

  const isValidYouTubeUrl = (url: string): boolean => {
    const patterns = [
      /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /https?:\/\/(?:www\.)?youtube\.com\/shorts\/[\w-]+/,
      /https?:\/\/youtu\.be\/[\w-]+/,
      /https?:\/\/(?:www\.)?youtube\.com\/embed\/[\w-]+/,
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const startDownload = async () => {
    if (!url.trim()) {
      Alert.alert('Hata', 'Lütfen bir YouTube URL\'si girin');
      return;
    }

    if (!isValidYouTubeUrl(url)) {
      Alert.alert('Hata', 'Lütfen geçerli bir YouTube URL\'si girin');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/download`, {
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
      const newJob: DownloadJob = {
        id: data.job_id,
        status: 'queued',
        progress: 0,
      };

      setCurrentJob(newJob);
      setUrl('');
      Alert.alert('Başarılı', 'İndirme başladı!');
    } catch (error) {
      Alert.alert('Hata', error instanceof Error ? error.message : 'İndirme başlatılamadı');
      console.error('Download error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`${API_BASE}/status/${jobId}`);
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

  // Poll job status every 1 second
  useEffect(() => {
    if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed') {
      return;
    }

    const interval = setInterval(() => {
      pollJobStatus(currentJob.id);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentJob]);

  const getDownloadLink = (filename: string) => {
    return `/files/${filename}`;
  };

  const handleDownload = (filename: string) => {
    try {
      const downloadUrl = getDownloadLink(filename);
      if (Platform.OS === 'web') {
        // Web: create download link
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Native: open in browser
        // You might want to use expo-web-browser here
        Alert.alert('İndir', 'Dosya tarayıcıda açılacak');
      }
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in new tab
      if (Platform.OS === 'web') {
        window.open(getDownloadLink(filename), '_blank');
      }
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Tamamlandı';
      case 'downloading': return 'İndiriliyor';
      case 'queued': return 'Sırada';
      case 'failed': return 'Başarısız';
      default: return 'Bilinmiyor';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>YouTube İndirici</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="YouTube URL'sini buraya yapıştırın..."
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.pasteButton} onPress={readClipboard}>
          <Text style={styles.pasteButtonText}>Yapıştır</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.downloadButton, isLoading && styles.downloadButtonDisabled]}
        onPress={startDownload}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.downloadButtonText}>İndir</Text>
        )}
      </TouchableOpacity>

      {currentJob && (
        <View style={styles.jobContainer}>
          <Text style={styles.jobTitle}>İndirme Durumu</Text>
          <View style={styles.jobCard}>
            <Text style={styles.jobStatus}>
              {getStatusText(currentJob.status)}
            </Text>
            
            {currentJob.status === 'downloading' && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${currentJob.progress}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>{currentJob.progress.toFixed(1)}%</Text>
              </View>
            )}

            {currentJob.status === 'completed' && currentJob.filename && (
              <View style={styles.completedContainer}>
                <Text style={styles.filenameText}>{currentJob.filename}</Text>
                <TouchableOpacity
                  style={styles.downloadLink}
                  onPress={() => handleDownload(currentJob.filename!)}
                >
                  <Text style={styles.downloadLinkText}>Dosyayı İndir</Text>
                </TouchableOpacity>
              </View>
            )}

            {currentJob.status === 'failed' && currentJob.error && (
              <Text style={styles.errorText}>Hata: {currentJob.error}</Text>
            )}
          </View>
        </View>
      )}

      {/* Version Indicator */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>v{APP_VERSION}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: 'white',
  },
  pasteButton: {
    marginLeft: 12,
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 8,
    justifyContent: 'center',
  },
  pasteButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  downloadButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  downloadButtonDisabled: {
    backgroundColor: '#ccc',
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  jobContainer: {
    marginTop: 20,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  jobCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 12,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  completedContainer: {
    marginBottom: 12,
  },
  filenameText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'monospace',
  },
  downloadLink: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  downloadLinkText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    fontStyle: 'italic',
  },
  versionContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  versionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
});
