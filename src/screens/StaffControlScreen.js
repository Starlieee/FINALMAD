import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../api';
import { Badge, Button, Card, ErrorMessage, PageTitle, Screen, Segmented } from '../components';
import theme from '../theme';

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function queueLabel(queue) {
  return queue.ticket || String(queue.number);
}

export default function StaffControlScreen({ session }) {
  const [panel, setPanel] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const isAdmin = session.role === 'admin';
  const [counter, setCounter] = useState(null);
  const counterName = isAdmin ? counter : undefined;

  const loadPanel = useCallback(async () => {
    try {
      const next = await api.getStaffPanel(session.id, counterName);
      setPanel(next);
      if (isAdmin && !counterName && next.counterName) setCounter(next.counterName);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [session.id, counterName, isAdmin]);

  useEffect(() => {
    loadPanel();
    const interval = setInterval(loadPanel, 5000);
    return () => clearInterval(interval);
  }, [loadPanel]);

  async function refresh() {
    setRefreshing(true);
    await loadPanel();
    setRefreshing(false);
  }

  async function runAction(action, operation) {
    setLoadingAction(action);
    setError('');
    try {
      await operation();
      await loadPanel();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setLoadingAction('');
    }
  }

  function skipActiveQueue() {
    const activeQueue = panel?.activeQueue;
    if (!activeQueue) return;
    Alert.alert(
      'Lewati antrean?',
      `Antrean ${queueLabel(activeQueue)} akan dipindahkan ke daftar yang dilewati.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Lewati',
          style: 'destructive',
          onPress: () => runAction('skip', () => api.skipStaffQueue(session.id, activeQueue.id, counterName)),
        },
      ],
    );
  }

  const activeQueue = panel?.activeQueue;
  const busy = Boolean(activeQueue);
  const statusLabel = activeQueue?.status === 'serving'
    ? 'SEDANG DILAYANI'
    : activeQueue
      ? 'DIPANGGIL'
      : 'LOKET TERSEDIA';

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <PageTitle
          eyebrow="Kontrol antrean"
          title={panel?.counterName || session.assignedCounter || 'Loket Petugas'}
          subtitle="Kelola antrean layanan di loket Anda."
          right={<Badge label={statusLabel} tone={activeQueue?.status === 'serving' ? 'success' : busy ? 'warning' : 'success'} />}
        />
        <ErrorMessage message={error} onRetry={loadPanel} />
        {isAdmin && panel?.counters?.length ? (
          <Segmented
            value={counter}
            onChange={(value) => { if (!loadingAction) { setPanel(null); setCounter(value); } }}
            options={panel.counters.map((name) => ({ value: name, label: name.replace(/^Loket\s+/, '') }))}
          />
        ) : null}

        <Text style={styles.sectionTitle}>Sedang ditangani</Text>
        <Card style={styles.activeCard}>
          {activeQueue ? (
            <>
              <Text style={styles.ticketLabel}>NOMOR ANTREAN</Text>
              <Text style={styles.ticketNumber}>{queueLabel(activeQueue)}</Text>
              <Badge
                label={activeQueue.status === 'serving' ? 'Sedang dilayani' : 'Sudah dipanggil'}
                tone={activeQueue.status === 'serving' ? 'success' : 'warning'}
              />
              {activeQueue.status === 'called' ? (
                <View style={styles.actions}>
                  <Button
                    label="Mulai Layani"
                    loading={loadingAction === 'start'}
                    disabled={Boolean(loadingAction)}
                    onPress={() => runAction('start', () => api.startStaffQueue(session.id, activeQueue.id, counterName))}
                  />
                  <Button
                    label="Panggil Ulang"
                    secondary
                    loading={loadingAction === 'recall'}
                    disabled={Boolean(loadingAction)}
                    onPress={() => runAction('recall', () => api.recallStaffQueue(session.id, activeQueue.id, counterName))}
                  />
                  <Button
                    label="Lewati"
                    secondary
                    loading={loadingAction === 'skip'}
                    disabled={Boolean(loadingAction)}
                    onPress={skipActiveQueue}
                  />
                </View>
              ) : (
                <View style={styles.actions}>
                  <Button
                    label="Selesai"
                    loading={loadingAction === 'complete'}
                    disabled={Boolean(loadingAction)}
                    onPress={() => runAction('complete', () => api.completeStaffQueue(session.id, activeQueue.id, counterName))}
                  />
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.emptyTitle}>Loket sedang kosong</Text>
              <Text style={styles.emptyText}>Panggil antrean berikutnya untuk mulai melayani.</Text>
              <View style={styles.actions}>
                <Button
                  label="Panggil Berikutnya"
                  loading={loadingAction === 'call-next'}
                  disabled={Boolean(loadingAction)}
                  onPress={() => runAction('call-next', () => api.callNext(session.id, counterName))}
                />
              </View>
            </>
          )}
        </Card>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Menunggu</Text>
          <Text style={styles.count}>{panel ? panel.waitingCount : '-'} antrean</Text>
        </View>
        {panel?.waiting.length ? panel.waiting.map((queue) => (
          <Card key={queue.id} style={styles.queueCard}>
            <Text style={styles.queueNumber}>{queueLabel(queue)}</Text>
            <Text style={styles.queueTime}>Masuk {formatTime(queue.createdAt)}</Text>
          </Card>
        )) : (
          <Card><Text style={styles.emptyText}>Tidak ada antrean yang menunggu.</Text></Card>
        )}

        <Text style={[styles.sectionTitle, styles.skippedTitle]}>Dilewati</Text>
        {panel?.skipped.length ? panel.skipped.map((queue) => (
          <Card key={queue.id} style={styles.queueCard}>
            <View style={styles.queueDetails}>
              <Text style={styles.queueNumber}>{queueLabel(queue)}</Text>
              <Text style={styles.queueTime}>Masuk {formatTime(queue.createdAt)}</Text>
            </View>
            <Button
              label="Panggil Kembali"
              secondary
              loading={loadingAction === `recall-${queue.id}`}
              disabled={busy || Boolean(loadingAction)}
              onPress={() => runAction(`recall-${queue.id}`, () => api.callSkippedQueue(session.id, queue.id, counterName))}
              style={styles.recallButton}
            />
          </Card>
        )) : (
          <Card><Text style={styles.emptyText}>Belum ada antrean yang dilewati.</Text></Card>
        )}
        {!panel && !error ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 12, marginTop: 6 },
  count: { color: theme.colors.muted, fontSize: 12, marginBottom: 11 },
  activeCard: { alignItems: 'center', paddingVertical: 22 },
  ticketLabel: { color: theme.colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  ticketNumber: { color: theme.colors.text, fontSize: 68, fontWeight: '700', letterSpacing: -2.5, marginVertical: 4 },
  actions: { width: '100%', gap: 9, marginTop: 16 },
  emptyTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  emptyText: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
  queueCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  queueDetails: { flex: 1 },
  queueNumber: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  queueTime: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },
  skippedTitle: { marginTop: 8 },
  recallButton: { minHeight: 40, paddingHorizontal: 12, marginLeft: 10 },
  loader: { marginVertical: 20 },
});
