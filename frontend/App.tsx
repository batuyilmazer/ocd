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
  const [debugMode, setDebugMode] = useState(false);

  const readClipboard = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web: try multiple clipboard methods with fallbacks
        let clipboardText = '';
        
        // Method 1: Try navigator.clipboard (modern browsers)
        try {
          // Check if we need to request permission first (common on Linux/Ubuntu)
          if (navigator.clipboard && navigator.permissions) {
            try {
              const permission = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
              if (permission.state === 'denied') {
                console.log('Clipboard permission denied');
                Alert.alert(
                  'Pano İzni Reddedildi', 
                  'Pano erişimi reddedildi. Lütfen tarayıcı ayarlarından pano erişimine izin verin veya URL\'yi manuel olarak yapıştırın.'
                );
                return;
              }
            } catch (permError) {
              console.log('Permission query not supported:', permError);
            }
          }
          
          clipboardText = await navigator.clipboard.readText();
          console.log('Clipboard method 1 (navigator.clipboard) successful');
        } catch (error) {
          console.log('Clipboard method 1 failed:', error);
          
          // Method 2: Try document.execCommand (legacy browsers)
          try {
            const textArea = document.createElement('textarea');
            textArea.value = '';
            document.body.appendChild(textArea);
            textArea.focus();
            const success = document.execCommand('paste');
            clipboardText = textArea.value;
            document.body.removeChild(textArea);
            
            if (success && clipboardText) {
              console.log('Clipboard method 2 (execCommand) successful');
            } else {
              console.log('Clipboard method 2 failed or empty');
            }
          } catch (execError) {
            console.log('Clipboard method 2 failed:', execError);
          }
        }
        
        // Method 3: Try to get from window.clipboardData (IE/Edge)
        if (!clipboardText && 'clipboardData' in window && (window as any).clipboardData) {
          try {
            clipboardText = (window as any).clipboardData.getData('text');
            console.log('Clipboard method 3 (window.clipboardData) successful');
          } catch (error) {
            console.log('Clipboard method 3 failed:', error);
          }
        }
        
        // If we got text from any method, validate and set it
        if (clipboardText && clipboardText.trim()) {
          console.log('Clipboard content:', clipboardText.substring(0, 100) + '...');
          
          if (isValidYouTubeUrl(clipboardText)) {
            setUrl(clipboardText);
            console.log('Valid YouTube URL found and set');
          } else {
            console.log('Clipboard content is not a valid YouTube URL');
            Alert.alert(
              'Geçersiz URL', 
              'Panoya kopyalanan metin geçerli bir YouTube URL\'si değil. Lütfen bir YouTube URL\'si kopyalayıp tekrar deneyin.'
            );
          }
        } else {
          console.log('No clipboard content found');
          
          // Provide Ubuntu-specific troubleshooting tips
          const isLinux = navigator.userAgent.includes('Linux') || navigator.userAgent.includes('Ubuntu');
          if (isLinux) {
            Alert.alert(
              'Pano Boş - Ubuntu/Linux', 
              'Ubuntu/Linux sistemlerde pano erişimi için:\n\n' +
              '1. Tarayıcıyı yeniden başlatın\n' +
              '2. Pano izinlerini kontrol edin\n' +
              '3. URL\'yi manuel olarak yapıştırın\n' +
              '4. Debug modunu açarak pano testi çalıştırın'
            );
          } else {
            Alert.alert(
              'Pano Boş', 
              'Panoda herhangi bir metin bulunamadı. Lütfen önce bir YouTube URL\'si kopyalayın, sonra tekrar deneyin.'
            );
          }
        }
      } else {
        // Native: use expo-clipboard
        const { data } = await Clipboard.getStringAsync();
        if (data && isValidYouTubeUrl(data)) {
          setUrl(data);
        }
      }
    } catch (error) {
      console.error('Clipboard read error:', error);
      
      // Provide more helpful error messages for different scenarios
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          Alert.alert(
            'Pano İzni Gerekli', 
            'Pano erişimi için tarayıcı izni gerekiyor. Lütfen tarayıcı ayarlarından pano erişimine izin verin.'
          );
        } else if (error.name === 'NotSupportedError') {
          Alert.alert(
            'Pano Desteklenmiyor', 
            'Bu tarayıcı pano erişimini desteklemiyor. Lütfen URL\'yi manuel olarak yapıştırın.'
          );
        } else {
          Alert.alert(
            'Pano Hatası', 
            'Pano okunamadı. Lütfen URL\'yi manuel olarak yapıştırın veya sayfayı yenileyip tekrar deneyin.'
          );
        }
      } else {
        Alert.alert(
          'Pano Hatası', 
          'Beklenmeyen bir hata oluştu. Lütfen URL\'yi manuel olarak yapıştırın.'
        );
      }
    }
  };

  const testClipboard = async () => {
    if (Platform.OS !== 'web') return;
    
    console.log('=== Clipboard Test ===');
    console.log('Platform:', Platform.OS);
    console.log('User Agent:', navigator.userAgent);
    console.log('HTTPS:', window.location.protocol === 'https:');
    console.log('Clipboard API available:', !!navigator.clipboard);
    
    try {
      // Test clipboard permissions
      if (navigator.clipboard) {
        const permissions = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
        console.log('Clipboard permission status:', permissions.state);
      }
    } catch (error) {
      console.log('Permission query failed:', error);
    }
    
    // Test each clipboard method
    let method1Success = false;
    let method2Success = false;
    let method3Success = false;
    
    // Method 1
    try {
      const text = await navigator.clipboard.readText();
      method1Success = !!text;
      console.log('Method 1 (navigator.clipboard):', method1Success ? 'SUCCESS' : 'FAILED - Empty');
    } catch (error) {
      console.log('Method 1 (navigator.clipboard): FAILED -', error);
    }
    
    // Method 2
    try {
      const textArea = document.createElement('textarea');
      textArea.value = '';
      document.body.appendChild(textArea);
      textArea.focus();
      const success = document.execCommand('paste');
      const text = textArea.value;
      document.body.removeChild(textArea);
      method2Success = success && !!text;
      console.log('Method 2 (execCommand):', method2Success ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      console.log('Method 2 (execCommand): FAILED -', error);
    }
    
    // Method 3
    try {
      if ('clipboardData' in window && (window as any).clipboardData) {
        const text = (window as any).clipboardData.getData('text');
        method3Success = !!text;
        console.log('Method 3 (window.clipboardData):', method3Success ? 'SUCCESS' : 'FAILED - Empty');
      } else {
        console.log('Method 3 (window.clipboardData): NOT AVAILABLE');
      }
    } catch (error) {
      console.log('Method 3 (window.clipboardData): FAILED -', error);
    }
    
    console.log('=== Test Results ===');
    console.log('Method 1 (navigator.clipboard):', method1Success ? '✅' : '❌');
    console.log('Method 2 (execCommand):', method2Success ? '✅' : '❌');
    console.log('Method 3 (window.clipboardData):', method3Success ? '✅' : '❌');
    
    const workingMethods = [method1Success, method2Success, method3Success].filter(Boolean).length;
    console.log('Working methods:', workingMethods, 'out of 3');
    
    if (workingMethods === 0) {
      Alert.alert(
        'Pano Testi', 
        'Hiçbir pano yöntemi çalışmıyor. Bu Ubuntu/Linux sistemlerde yaygın bir sorundur. Lütfen URL\'yi manuel olarak yapıştırın.'
      );
    } else {
      Alert.alert(
        'Pano Testi', 
        `${workingMethods} pano yöntemi çalışıyor. Detaylar için konsolu kontrol edin.`
      );
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
      
      <Text style={styles.instructionText}>
        💡 Pano butonuna tıklayarak YouTube URL'sini otomatik yapıştırabilir veya URL'yi manuel olarak yazabilirsiniz
      </Text>

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
        <TouchableOpacity 
          style={styles.debugToggle} 
          onPress={() => setDebugMode(!debugMode)}
        >
          <Text style={styles.debugToggleText}>
            {debugMode ? '🔍 Debug Kapat' : '🐛 Debug Aç'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Debug Information */}
      {debugMode && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Bilgileri</Text>
          <Text style={styles.debugText}>Platform: {Platform.OS}</Text>
          <Text style={styles.debugText}>User Agent: {navigator.userAgent}</Text>
          <Text style={styles.debugText}>Clipboard API: {navigator.clipboard ? 'Destekleniyor' : 'Desteklenmiyor'}</Text>
          <Text style={styles.debugText}>HTTPS: {window.location.protocol === 'https:' ? 'Evet' : 'Hayır'}</Text>
          <Text style={styles.debugText}>URL: {url || 'Boş'}</Text>
          
          <TouchableOpacity 
            style={styles.testButton} 
            onPress={testClipboard}
          >
            <Text style={styles.testButtonText}>Pano Testi Çalıştır</Text>
          </TouchableOpacity>
          
          {/* Ubuntu/Linux Troubleshooting */}
          {(navigator.userAgent.includes('Linux') || navigator.userAgent.includes('Ubuntu')) && (
            <View style={styles.troubleshootContainer}>
              <Text style={styles.troubleshootTitle}>Ubuntu/Linux Pano Sorunları</Text>
              <Text style={styles.troubleshootText}>
                Ubuntu/Linux sistemlerde pano erişimi için:
              </Text>
              <Text style={styles.troubleshootText}>• Tarayıcıyı yeniden başlatın</Text>
              <Text style={styles.troubleshootText}>• Pano izinlerini kontrol edin</Text>
              <Text style={styles.troubleshootText}>• URL'yi manuel olarak yapıştırın</Text>
              <Text style={styles.troubleshootText}>• Pano testi çalıştırın</Text>
            </View>
          )}
        </View>
      )}
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
  debugToggle: {
    marginTop: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
  },
  debugToggleText: {
    fontSize: 12,
    color: '#333',
  },
  debugContainer: {
    marginTop: 20,
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  debugText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    marginBottom: 15,
    textAlign: 'center',
  },
  testButton: {
    marginTop: 10,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  testButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  troubleshootContainer: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  troubleshootTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  troubleshootText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 3,
  },
});
