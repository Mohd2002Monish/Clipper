import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Linking,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as ExpoLinking from 'expo-linking';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ApiService } from './src/services/api';
import { DriveFolder, ClipQueueItem } from './src/types';

const STORAGE_SERVER_URL_KEY = '@clip_queue_server_url';
const DEFAULT_SERVER_URL = 'https://clip-queue-server.vercel.app';

export default function App() {
  const [serverUrl, setServerUrl] = useState<string>(DEFAULT_SERVER_URL);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [tempServerUrl, setTempServerUrl] = useState<string>('');

  const [urlInput, setUrlInput] = useState<string>('');
  const [folders, setFolders] = useState<DriveFolder[]>([
    { id: 'Shorts', name: 'Shorts' },
    { id: 'General', name: 'General' },
    { id: 'GTA-5', name: 'GTA-5' },
    { id: 'Movie-Vault', name: 'Movie-Vault' },
  ]);
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder>({
    id: 'Shorts',
    name: 'Shorts',
  });
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState<boolean>(false);

  const [queueItems, setQueueItems] = useState<ClipQueueItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [serverConnected, setServerConnected] = useState<boolean>(false);

  // 1. Load persisted Server URL
  useEffect(() => {
    (async () => {
      try {
        const savedUrl = await AsyncStorage.getItem(STORAGE_SERVER_URL_KEY);
        if (savedUrl) {
          setServerUrl(savedUrl);
        }
      } catch {}
    })();
  }, []);

  // 2. Fetch Drive folders & Queue from server
  const refreshData = useCallback(async () => {
    if (!serverUrl) return;
    try {
      setIsLoadingQueue(true);
      const [fetchedFolders, fetchedQueue] = await Promise.all([
        ApiService.fetchFolders(serverUrl).catch(() => []),
        ApiService.fetchQueue(serverUrl).catch(() => []),
      ]);

      if (fetchedFolders.length > 0) {
        setFolders(fetchedFolders);
      }
      setQueueItems(fetchedQueue);
      setServerConnected(true);
    } catch {
      setServerConnected(false);
    } finally {
      setIsLoadingQueue(false);
    }
  }, [serverUrl]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 15000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // 3. Listen for Incoming Share Intent (iOS & Android)
  useEffect(() => {
    const handleIncomingUrl = (event: { url: string }) => {
      if (event.url) {
        const parsed = ExpoLinking.parse(event.url);
        const sharedText = (parsed.queryParams?.text as string) || (parsed.queryParams?.url as string) || event.url;

        // Extract any http/https URL from shared text
        const urlMatch = sharedText.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          setUrlInput(urlMatch[0]);
        }
      }
    };

    ExpoLinking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        handleIncomingUrl({ url: initialUrl });
      }
    });

    const sub = ExpoLinking.addEventListener('url', handleIncomingUrl);
    return () => sub.remove();
  }, []);

  // 4. Paste from clipboard helper
  const handlePasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text && (text.includes('youtube.com') || text.includes('youtu.be') || text.includes('instagram.com'))) {
      const match = text.match(/https?:\/\/[^\s]+/);
      setUrlInput(match ? match[0] : text.trim());
    } else if (text) {
      setUrlInput(text.trim());
    } else {
      Alert.alert('Clipboard Empty', 'No URL found on clipboard.');
    }
  };

  // 5. Submit clip to Vercel queue
  const handleSubmitClip = async () => {
    if (!urlInput.trim()) {
      Alert.alert('Required', 'Please enter or paste a video URL.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await ApiService.submitClip(serverUrl, {
        url: urlInput.trim(),
        folderId: selectedFolder.id,
        folderName: selectedFolder.name,
        sourceClient: 'react_native_mobile',
      });

      setUrlInput('');
      Alert.alert(
        result.alreadyQueued ? 'Already in Queue' : 'Added to Drive Queue',
        `Video sent for Google Drive folder "${selectedFolder.name}". VideoTimmer on your Mac will download and stage it automatically.`
      );
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Failed to Queue', `${msg}\n\nPlease verify your server URL in Settings.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSettings = async () => {
    const trimmed = tempServerUrl.trim().replace(/\/+$/, '');
    if (!trimmed) {
      Alert.alert('Error', 'Server URL cannot be empty.');
      return;
    }
    await AsyncStorage.setItem(STORAGE_SERVER_URL_KEY, trimmed);
    setServerUrl(trimmed);
    setIsSettingsOpen(false);
    setTimeout(refreshData, 500);
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <View style={[styles.badge, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
            <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
            <Text style={[styles.badgeText, { color: '#15803d' }]}>Uploaded to Drive</Text>
          </View>
        );
      case 'downloading':
      case 'processing':
        return (
          <View style={[styles.badge, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
            <ActivityIndicator size="small" color="#2563eb" style={{ transform: [{ scale: 0.6 }] }} />
            <Text style={[styles.badgeText, { color: '#1d4ed8' }]}>Mac Downloading</Text>
          </View>
        );
      case 'uploading_to_drive':
        return (
          <View style={[styles.badge, { backgroundColor: '#e0e7ff', borderColor: '#a5b4fc' }]}>
            <Ionicons name="cloud-upload" size={12} color="#4f46e5" />
            <Text style={[styles.badgeText, { color: '#4338ca' }]}>Streaming to Drive</Text>
          </View>
        );
      case 'failed':
        return (
          <View style={[styles.badge, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
            <Ionicons name="alert-circle" size={12} color="#dc2626" />
            <Text style={[styles.badgeText, { color: '#b91c1c' }]}>Failed</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badge, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
            <Ionicons name="time" size={12} color="#d97706" />
            <Text style={[styles.badgeText, { color: '#b45309' }]}>Pending Mac Sync</Text>
          </View>
        );
    }
  };

  const getPlatformIcon = (platform: string) => {
    if (platform?.includes('youtube')) {
      return <Ionicons name="logo-youtube" size={18} color="#ef4444" />;
    }
    if (platform?.includes('instagram')) {
      return <Ionicons name="logo-instagram" size={18} color="#ec4899" />;
    }
    return <Ionicons name="link" size={18} color="#64748b" />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.brandRow}>
            <Ionicons name="phone-portrait-outline" size={16} color="#0284c7" />
            <Text style={styles.brandText}>Clip Ingest Mobile</Text>
          </View>
          <Text style={styles.titleText}>Google Drive Staging</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.statusDot, { backgroundColor: serverConnected ? '#22c55e' : '#f59e0b' }]}
            onPress={() => {
              setTempServerUrl(serverUrl);
              setIsSettingsOpen(true);
            }}
          />
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              setTempServerUrl(serverUrl);
              setIsSettingsOpen(true);
            }}
          >
            <Ionicons name="settings-outline" size={20} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Input Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Share or Paste Video Link</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Paste YouTube, Shorts, or Reels link..."
              placeholderTextColor="#94a3b8"
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {urlInput.length > 0 && (
              <TouchableOpacity onPress={() => setUrlInput('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.pasteRow}>
            <TouchableOpacity style={styles.pasteBtn} onPress={handlePasteFromClipboard}>
              <Ionicons name="clipboard-outline" size={14} color="#0284c7" />
              <Text style={styles.pasteBtnText}>Paste from Clipboard</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.folderBtn} onPress={() => setIsFolderPickerOpen(true)}>
              <Ionicons name="folder-outline" size={14} color="#475569" />
              <Text style={styles.folderBtnText}>{selectedFolder.name}</Text>
              <Ionicons name="chevron-down" size={14} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (isSubmitting || !urlInput.trim()) && styles.submitBtnDisabled]}
            onPress={handleSubmitClip}
            disabled={isSubmitting || !urlInput.trim()}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={18} color="#ffffff" />
                <Text style={styles.submitBtnText}>Send to Google Drive</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Queue Section */}
        <View style={styles.queueHeader}>
          <Text style={styles.queueTitle}>Staging Queue</Text>
          <TouchableOpacity onPress={refreshData} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={16} color="#0284c7" />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {queueItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={36} color="#cbd5e1" />
            <Text style={styles.emptyText}>No clips in queue</Text>
            <Text style={styles.emptySubtext}>
              Share a video link from YouTube or Instagram to queue downloads to your Google Drive.
            </Text>
          </View>
        ) : (
          queueItems.map((item) => (
            <View key={item._id} style={styles.queueCard}>
              <View style={styles.queueCardLeft}>
                {getPlatformIcon(item.platform)}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.queueCardTitle} numberOfLines={1}>
                    {item.contentMeta?.title || item.driveDetails?.fileName || item.cleanUrl}
                  </Text>
                  <Text style={styles.queueCardFolder} numberOfLines={1}>
                    Folder: {item.targetFolder?.folderName || 'General'}
                  </Text>
                </View>
              </View>

              <View style={styles.queueCardRight}>
                {renderStatusBadge(item.status)}
                {item.driveDetails?.webViewLink && (
                  <TouchableOpacity
                    style={styles.driveLinkBtn}
                    onPress={() => Linking.openURL(item.driveDetails!.webViewLink!)}
                  >
                    <Ionicons name="open-outline" size={16} color="#0284c7" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Folder Picker Modal */}
      <Modal visible={isFolderPickerOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Destination Drive Folder</Text>
            <FlatList
              data={folders}
              keyExtractor={(f) => f.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.folderItem,
                    selectedFolder.id === item.id && styles.folderItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedFolder(item);
                    setIsFolderPickerOpen(false);
                  }}
                >
                  <Ionicons
                    name="folder"
                    size={20}
                    color={selectedFolder.id === item.id ? '#0284c7' : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.folderItemText,
                      selectedFolder.id === item.id && styles.folderItemTextSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {selectedFolder.id === item.id && (
                    <Ionicons name="checkmark" size={18} color="#0284c7" />
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setIsFolderPickerOpen(false)}
            >
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={isSettingsOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Ingestion Server Settings</Text>
            <Text style={styles.modalSub}>
              Enter your Vercel deployment URL (e.g. https://clip-queue.vercel.app) or local IP.
            </Text>

            <TextInput
              style={styles.modalInput}
              value={tempServerUrl}
              onChangeText={setTempServerUrl}
              placeholder="https://your-app.vercel.app"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsSettingsOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveSettings}>
                <Text style={styles.modalSaveText}>Save URL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 10,
  },
  inputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#0f172a',
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
  },
  pasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  pasteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
  },
  folderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  folderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 14,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  queueTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  emptyContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  queueCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  queueCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  queueCardFolder: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  queueCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  driveLinkBtn: {
    padding: 6,
    backgroundColor: '#f0f9ff',
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modalSaveBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  folderItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  folderItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  folderItemTextSelected: {
    fontWeight: '800',
    color: '#0284c7',
  },
  closeModalBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
});

