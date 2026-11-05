import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Linking,
  ScrollView,
  FlatList,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as ExpoLinking from 'expo-linking';
import { useShareIntent } from 'expo-share-intent';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from './src/services/api';
import { DriveFolder, ClipQueueItem, WorkerHeartbeatStatus } from './src/types';

const STORAGE_SERVER_URL_KEY = '@clip_queue_server_url';
const STORAGE_INSTANT_INGEST_KEY = '@clip_queue_instant_ingest';
const DEFAULT_SERVER_URL = 'https://clip-queue-server.vercel.app';

export default function App() {
  const [serverUrl, setServerUrl] = useState<string>(DEFAULT_SERVER_URL);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [tempServerUrl, setTempServerUrl] = useState<string>('');

  // Zero-Tap Instant Ingest state
  const [instantIngestEnabled, setInstantIngestEnabled] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Link inputs & Batch detection
  const [urlInput, setUrlInput] = useState<string>('');
  const [detectedBatchUrls, setDetectedBatchUrls] = useState<string[]>([]);
  const [noteInput, setNoteInput] = useState<string>('');

  // Drive Folders state
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

  // Live status & Queue state
  const [queueItems, setQueueItems] = useState<ClipQueueItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [serverConnected, setServerConnected] = useState<boolean>(false);
  const [macHeartbeat, setMacHeartbeat] = useState<WorkerHeartbeatStatus>({ isOnline: false });
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // 1. Smart Folder Auto-Routing Helper
  const resolveSmartFolder = useCallback(
    (url: string, note?: string): DriveFolder => {
      const lowerUrl = url.toLowerCase();
      const lowerNote = (note || '').toLowerCase();

      // Check gaming
      if (lowerUrl.includes('gta') || lowerNote.includes('gta')) {
        const found = folders.find((f) => f.name.toLowerCase().includes('gta'));
        if (found) return found;
      }

      // Check Movie-Vault / #VAULT
      if (lowerUrl.includes('vault') || lowerNote.includes('vault') || lowerNote.includes('#vault')) {
        const found = folders.find((f) => f.name.toLowerCase().includes('vault'));
        if (found) return found;
      }

      // Check Reels / Shorts
      if (
        lowerUrl.includes('/reel') ||
        lowerUrl.includes('/reels') ||
        lowerUrl.includes('/shorts') ||
        lowerUrl.includes('youtu.be/')
      ) {
        const found = folders.find((f) => f.name.toLowerCase() === 'shorts');
        if (found) return found;
      }

      // Check long-form YouTube / standard
      if (lowerUrl.includes('youtube.com/watch')) {
        const found = folders.find((f) => f.name.toLowerCase() === 'general');
        if (found) return found;
      }

      return selectedFolder;
    },
    [folders, selectedFolder]
  );

  // 2. Handle detected URLs (from Share Intent or Clipboard)
  const processIncomingText = useCallback(
    (text: string) => {
      if (!text) return;
      const urlRegex = /https?:\/\/[^\s]+/g;
      const matches = text.match(urlRegex) || [];

      if (matches.length > 1) {
        // Multi-link batch detected!
        setDetectedBatchUrls(matches);
        setUrlInput(matches[0]);
        setSuccessNotice(null);
        setCountdown(null);
      } else if (matches.length === 1) {
        // Single link detected
        const singleUrl = matches[0];
        setDetectedBatchUrls([]);
        setUrlInput(singleUrl);
        setSuccessNotice(null);

        // Smart route target folder
        const smartTarget = resolveSmartFolder(singleUrl, noteInput);
        setSelectedFolder(smartTarget);

        // Trigger Zero-Tap countdown if enabled
        if (instantIngestEnabled) {
          setCountdown(3);
        }
      }
    },
    [instantIngestEnabled, resolveSmartFolder, noteInput]
  );

  // 3. Countdown effect for Zero-Tap Auto-Ingest
  useEffect(() => {
    if (countdown === null) {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }

    if (countdown <= 0) {
      setCountdown(null);
      handleSubmitClip();
      return;
    }

    countdownTimerRef.current = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, [countdown]);

  const handleCancelCountdown = () => {
    setCountdown(null);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
  };

  // 4. Native Share Intent Hook
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      const incoming = shareIntent.text || shareIntent.webUrl || '';
      if (incoming) {
        processIncomingText(incoming);
      }
      resetShareIntent();
    }
  }, [hasShareIntent, shareIntent, resetShareIntent, processIncomingText]);

  // 5. Load persisted settings
  useEffect(() => {
    (async () => {
      try {
        const [savedUrl, savedInstant] = await Promise.all([
          AsyncStorage.getItem(STORAGE_SERVER_URL_KEY),
          AsyncStorage.getItem(STORAGE_INSTANT_INGEST_KEY),
        ]);
        if (savedUrl) setServerUrl(savedUrl);
        if (savedInstant !== null) setInstantIngestEnabled(savedInstant === 'true');
      } catch {}
    })();
  }, []);

  // 6. Fetch Drive folders, Queue & Mac Heartbeat
  const refreshData = useCallback(async () => {
    if (!serverUrl) return;
    try {
      setIsLoadingQueue(true);
      const [fetchedFolders, fetchedQueue, heartbeat] = await Promise.all([
        ApiService.fetchFolders(serverUrl).catch(() => []),
        ApiService.fetchQueue(serverUrl).catch(() => []),
        ApiService.fetchWorkerHeartbeat(serverUrl).catch(() => ({ isOnline: false })),
      ]);

      if (fetchedFolders.length > 0) {
        setFolders(fetchedFolders);
      }
      setQueueItems(fetchedQueue);
      setMacHeartbeat(heartbeat);
      setServerConnected(true);
    } catch {
      setServerConnected(false);
    } finally {
      setIsLoadingQueue(false);
    }
  }, [serverUrl]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 12000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // 7. Clipboard auto-detection on app active
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = await Clipboard.getStringAsync();
        if (
          text &&
          (text.includes('instagram.com') ||
            text.includes('youtube.com') ||
            text.includes('youtu.be') ||
            text.includes('tiktok.com'))
        ) {
          if (!urlInput && detectedBatchUrls.length === 0) {
            processIncomingText(text);
          }
        }
      } catch {}
    };

    checkClipboard();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkClipboard();
        refreshData();
      }
    });
    return () => sub.remove();
  }, [urlInput, detectedBatchUrls.length, processIncomingText, refreshData]);

  // 8. Deep Link Listener Fallback
  useEffect(() => {
    const handleIncomingUrl = (event: { url: string }) => {
      if (event.url) {
        const parsed = ExpoLinking.parse(event.url);
        const sharedText = (parsed.queryParams?.text as string) || (parsed.queryParams?.url as string) || event.url;
        processIncomingText(sharedText);
      }
    };

    ExpoLinking.getInitialURL().then((initialUrl) => {
      if (initialUrl) handleIncomingUrl({ url: initialUrl });
    });

    const sub = ExpoLinking.addEventListener('url', handleIncomingUrl);
    return () => sub.remove();
  }, [processIncomingText]);

  // 9. Manual Paste helper
  const handlePasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      processIncomingText(text);
    } else {
      Alert.alert('Clipboard Empty', 'No URL found on clipboard.');
    }
  };

  // 10. Submit single clip
  const handleSubmitClip = async () => {
    handleCancelCountdown();
    const targetUrl = urlInput.trim();
    if (!targetUrl) {
      Alert.alert('Required', 'Please share or paste a video link first.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSuccessNotice(null);

      const result = await ApiService.submitClip(serverUrl, {
        url: targetUrl,
        folderId: selectedFolder.id,
        folderName: selectedFolder.name,
        notes: noteInput.trim() || undefined,
        sourceClient: 'react_native_mobile',
      });

      setUrlInput('');
      setNoteInput('');
      setDetectedBatchUrls([]);
      setSuccessNotice(
        result.alreadyQueued
          ? `Clip is already queued for "${selectedFolder.name}".`
          : `Queued to Drive / ${selectedFolder.name}! Mac worker will process it.`
      );

      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Failed to Queue', `${msg}\n\nPlease verify your server URL in Settings.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 11. Submit Batch of Clips
  const handleSubmitBatch = async () => {
    if (detectedBatchUrls.length === 0) return;

    try {
      setIsSubmitting(true);
      setSuccessNotice(null);

      const payload = detectedBatchUrls.map((u) => ({
        url: u,
        folderId: selectedFolder.id,
        folderName: selectedFolder.name,
        notes: noteInput.trim() || undefined,
        sourceClient: 'react_native_batch',
      }));

      const res = await ApiService.submitBatchClips(serverUrl, payload);

      setSuccessNotice(
        `Batch Queued: ${res.addedCount} clips added to Drive / ${selectedFolder.name} (${res.skippedCount} skipped).`
      );
      setDetectedBatchUrls([]);
      setUrlInput('');
      setNoteInput('');
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Batch Failed', msg);
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
    await AsyncStorage.setItem(STORAGE_INSTANT_INGEST_KEY, String(instantIngestEnabled));
    setServerUrl(trimmed);
    setIsSettingsOpen(false);
    setTimeout(refreshData, 500);
  };

  // Detect platform
  const getDetectedPlatform = () => {
    if (!urlInput) return null;
    const lower = urlInput.toLowerCase();
    if (lower.includes('instagram.com/reel') || lower.includes('instagram.com/reels')) {
      return { name: 'Instagram Reel', icon: 'logo-instagram', color: '#ec4899' };
    }
    if (lower.includes('instagram.com')) {
      return { name: 'Instagram Video', icon: 'logo-instagram', color: '#ec4899' };
    }
    if (lower.includes('youtube.com/shorts') || lower.includes('youtu.be')) {
      return { name: 'YouTube Short', icon: 'logo-youtube', color: '#ef4444' };
    }
    if (lower.includes('youtube.com')) {
      return { name: 'YouTube Video', icon: 'logo-youtube', color: '#ef4444' };
    }
    return { name: 'Web Video Link', icon: 'link', color: '#0284c7' };
  };

  const detectedPlatform = getDetectedPlatform();

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

      {/* Top Header with Live Mac Heartbeat */}
      <View style={styles.header}>
        <View>
          <View style={styles.brandRow}>
            <Ionicons name="film-outline" size={16} color="#0284c7" />
            <Text style={styles.brandText}>Clip Ingest</Text>
            {/* Live Mac Heartbeat Pill */}
            <View
              style={[
                styles.macPill,
                { backgroundColor: macHeartbeat.isOnline ? '#f0fdf4' : '#fffbeb', borderColor: macHeartbeat.isOnline ? '#bbf7d0' : '#fef08a' },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: macHeartbeat.isOnline ? '#22c55e' : '#f59e0b' },
                ]}
              />
              <Text
                style={[
                  styles.macPillText,
                  { color: macHeartbeat.isOnline ? '#166534' : '#854d0e' },
                ]}
              >
                {macHeartbeat.isOnline
                  ? macHeartbeat.activeIngests && macHeartbeat.activeIngests > 0
                    ? `Mac Ingesting (${macHeartbeat.activeIngests})`
                    : 'Mac Active'
                  : 'Mac Sleeping'}
              </Text>
            </View>
          </View>
          <Text style={styles.titleText}>Google Drive Staging</Text>
        </View>

        <View style={styles.headerRight}>
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

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Zero-Tap Auto-Countdown Banner */}
        {countdown !== null && (
          <View style={styles.countdownBanner}>
            <View style={styles.countdownRow}>
              <View style={styles.countdownPill}>
                <Text style={styles.countdownPillText}>{countdown}s</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.countdownTitle}>Zero-Tap Auto-Queue</Text>
                <Text style={styles.countdownSub}>
                  Sending to Drive / {selectedFolder.name} in {countdown}s...
                </Text>
              </View>
              <TouchableOpacity onPress={handleCancelCountdown} style={styles.cancelCountdownBtn}>
                <Ionicons name="close-circle-outline" size={16} color="#dc2626" />
                <Text style={styles.cancelCountdownText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Success Banner */}
        {successNotice && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#15803d" />
            <Text style={styles.successBannerText}>{successNotice}</Text>
            <TouchableOpacity onPress={() => setSuccessNotice(null)}>
              <Ionicons name="close" size={16} color="#15803d" />
            </TouchableOpacity>
          </View>
        )}

        {/* Multi-Link Batch Banner if detected */}
        {detectedBatchUrls.length > 1 && (
          <View style={styles.batchBanner}>
            <View style={styles.batchHeaderRow}>
              <View style={styles.batchCountPill}>
                <Ionicons name="layers-outline" size={14} color="#0284c7" />
                <Text style={styles.batchCountText}>{detectedBatchUrls.length} Clips Detected</Text>
              </View>
              <TouchableOpacity onPress={() => setDetectedBatchUrls([])}>
                <Text style={styles.clearBatchText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.batchSub}>
              Multiple URLs found on clipboard/share. Choose destination folder below to queue all simultaneously.
            </Text>
          </View>
        )}

        {/* Action Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeader}>
              {detectedBatchUrls.length > 1 ? 'Batch Queue Staging' : 'Video Link for Ingestion'}
            </Text>
            {detectedPlatform && detectedBatchUrls.length <= 1 && (
              <View style={[styles.platformPill, { borderColor: detectedPlatform.color }]}>
                <Ionicons name={detectedPlatform.icon as any} size={12} color={detectedPlatform.color} />
                <Text style={[styles.platformPillText, { color: detectedPlatform.color }]}>
                  {detectedPlatform.name}
                </Text>
              </View>
            )}
          </View>

          {/* URL Input Box */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Shared video link appears here automatically..."
              placeholderTextColor="#94a3b8"
              value={urlInput}
              onChangeText={(t) => {
                handleCancelCountdown();
                setUrlInput(t);
                if (successNotice) setSuccessNotice(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {urlInput.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  handleCancelCountdown();
                  setUrlInput('');
                  setDetectedBatchUrls([]);
                }}
                style={styles.clearBtn}
              >
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Note & Tag Input (Desktop Bridge) */}
          <View style={styles.noteContainer}>
            <Ionicons name="create-outline" size={14} color="#64748b" style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.noteInput}
              placeholder="Optional note / tag (e.g. #VAULT, Friday hook)..."
              placeholderTextColor="#94a3b8"
              value={noteInput}
              onChangeText={setNoteInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Secondary Paste Action */}
          <View style={styles.pasteRow}>
            <TouchableOpacity style={styles.pasteBtn} onPress={handlePasteFromClipboard}>
              <Ionicons name="clipboard-outline" size={13} color="#0284c7" />
              <Text style={styles.pasteBtnText}>Paste from Clipboard</Text>
            </TouchableOpacity>

            {detectedBatchUrls.length > 1 && (
              <Text style={styles.batchIndicatorText}>
                {detectedBatchUrls.length} links ready
              </Text>
            )}
          </View>

          {/* 1-Tap Target Folder Chips */}
          <View style={styles.folderSection}>
            <View style={styles.folderSectionHeader}>
              <Text style={styles.folderSectionLabel}>Target Drive Folder:</Text>
              <TouchableOpacity onPress={() => setIsFolderPickerOpen(true)} style={styles.allFoldersBtn}>
                <Text style={styles.allFoldersBtnText}>More ({folders.length})</Text>
                <Ionicons name="chevron-forward" size={12} color="#0284c7" />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderChipsRow}>
              {folders.map((f) => {
                const isSelected = selectedFolder.id === f.id || selectedFolder.name === f.name;
                return (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => {
                      handleCancelCountdown();
                      setSelectedFolder(f);
                    }}
                    style={[styles.folderChip, isSelected && styles.folderChipActive]}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'folder-outline'}
                      size={14}
                      color={isSelected ? '#ffffff' : '#475569'}
                    />
                    <Text style={[styles.folderChipText, isSelected && styles.folderChipTextActive]}>
                      {f.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Main Action Button */}
          {detectedBatchUrls.length > 1 ? (
            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleSubmitBatch}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="layers" size={18} color="#ffffff" />
                  <Text style={styles.submitBtnText}>
                    Add All {detectedBatchUrls.length} Clips to {selectedFolder.name}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
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
                  <Text style={styles.submitBtnText}>
                    {urlInput.trim() ? `Add to Drive • ${selectedFolder.name}` : 'Share or Paste Video Link'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
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
                  <View style={styles.queueCardSubRow}>
                    <Text style={styles.queueCardFolder} numberOfLines={1}>
                      Folder: {item.targetFolder?.folderName || 'General'}
                    </Text>
                    {item.contentMeta?.notes ? (
                      <View style={styles.queueNotePill}>
                        <Text style={styles.queueNoteText} numberOfLines={1}>
                          {item.contentMeta.notes}
                        </Text>
                      </View>
                    ) : null}
                  </View>
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

      {/* Settings Modal */}
      <Modal visible={isSettingsOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>App Settings</Text>
            <Text style={styles.modalSub}>
              Configure server connection and automation preferences.
            </Text>

            {/* Zero-Tap Ingest Switch */}
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Zero-Tap Ingest</Text>
                <Text style={styles.settingHelp}>
                  Automatically starts a 3s countdown to queue shared clips without touching anything.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setInstantIngestEnabled(!instantIngestEnabled)}
                style={[styles.toggleBtn, instantIngestEnabled && styles.toggleBtnActive]}
              >
                <View style={[styles.toggleThumb, instantIngestEnabled && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.settingLabel, { marginTop: 14 }]}>Server URL</Text>
            <TextInput
              style={styles.modalInput}
              value={tempServerUrl}
              onChangeText={setTempServerUrl}
              placeholder="https://clip-queue-server.vercel.app"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsSettingsOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveSettings}>
                <Text style={styles.modalSaveText}>Save &amp; Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Folder Picker Modal */}
      <Modal visible={isFolderPickerOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Destination Drive Folder</Text>
            <Text style={styles.modalSub}>
              Videos will be downloaded and staged in this folder on your Google Drive.
            </Text>

            <FlatList
              data={folders}
              keyExtractor={(f) => f.id}
              style={{ maxHeight: 280 }}
              renderItem={({ item }) => {
                const isSelected = selectedFolder.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.folderItem, isSelected && styles.folderItemSelected]}
                    onPress={() => {
                      handleCancelCountdown();
                      setSelectedFolder(item);
                      setIsFolderPickerOpen(false);
                    }}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'folder-outline'}
                      size={20}
                      color={isSelected ? '#0284c7' : '#64748b'}
                    />
                    <Text style={[styles.folderItemText, isSelected && styles.folderItemTextSelected]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setIsFolderPickerOpen(false)}>
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284c7',
  },
  macPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  macPillText: {
    fontSize: 10,
    fontWeight: '700',
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
    width: 6,
    height: 6,
    borderRadius: 3,
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
  countdownBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countdownPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownPillText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  countdownTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991b1b',
  },
  countdownSub: {
    fontSize: 11,
    color: '#b91c1c',
  },
  cancelCountdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  cancelCountdownText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  successBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
  },
  batchBanner: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  batchHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  batchCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  batchCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369a1',
  },
  clearBatchText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  batchSub: {
    fontSize: 11,
    color: '#0284c7',
    lineHeight: 16,
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  platformPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  platformPillText: {
    fontSize: 11,
    fontWeight: '700',
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
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginTop: 8,
  },
  noteInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 12,
    color: '#334155',
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
  },
  pasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  pasteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284c7',
  },
  batchIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  folderSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  folderSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  folderSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  allFoldersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  allFoldersBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  folderChipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  folderChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  folderChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  folderChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
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
  queueCardSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  queueCardFolder: {
    fontSize: 11,
    color: '#64748b',
  },
  queueNotePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  queueNoteText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#92400e',
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
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  settingHelp: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    paddingRight: 10,
  },
  toggleBtn: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#cbd5e1',
    padding: 2,
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#0284c7',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    marginTop: 6,
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
