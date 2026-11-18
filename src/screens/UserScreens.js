import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, StyleSheet, Text, Vibration, View } from 'react-native';
import { api } from '../api';
import {
  Badge, Button, Card, EmptyState, ErrorMessage, Icon, Loader, Notice, PageTitle, Screen, SectionTitle, Stat,
} from '../components';
import { formatDate, formatTime, useLiveData } from '../hooks';
import theme, { eventStatusMeta, statusMeta } from '../theme';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function EventStatus({ status }) {
  const meta = eventStatusMeta[status] || eventStatusMeta.closed;
  return <Badge label={meta.label} tone={meta.tone} />;
}

export function HomeScreen({ session, navigation }) {
  const loader = useCallback(async () => {
    const [summary, mine] = await Promise.all([
      api.getSummary(),
      session.role === 'petugas' ? Promise.resolve(null) : api.getMyQueues(session.id),
    ]);
    return { summary, mine };
  }, [session]);
  const { data, error, load, refresh, refreshing } = useLiveData(loader, 10000);
  const events = data?.summary.events || [];
  const active = data?.mine?.active;
  const openCount = events.filter((event) => event.status === 'open').length;
  const waitingCount = events.reduce((sum, event) => sum + event.waitingCount, 0);

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <PageTitle eyebrow={greeting()} title={session.name.split(' ')[0]} subtitle={formatDate(data?.summary.date)} />
      <ErrorMessage message={error} onRetry={load} />

      {active ? (
        <Pressable onPress={() => navigation.navigate('Antrean Saya')}>
          <Card dark style={styles.heroCard}>
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>ANTREAN AKTIF</Text>
              <Badge label={statusMeta[active.status].label} tone="dark" />
            </View>
            <Text style={styles.heroNumber}>{active.ticket}</Text>
            <Text style={styles.heroMeta}>{active.eventName}</Text>
            <View style={styles.heroDivider} />
            <View style={styles.heroRow}>
              <Text style={styles.heroMeta}>
                {active.status === 'waiting' ? `${active.aheadCount} orang di depan kamu` : `Silakan ke ${active.counterName}`}
              </Text>
              <Icon name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          </Card>
        </Pressable>
      ) : session.role !== 'petugas' ? (
        <Card dark style={styles.heroCard}>
          <Text style={styles.heroLabel}>TANPA ANTRE FISIK</Text>
          <Text style={styles.heroTitle}>Ambil nomor dari mana saja, datang saat giliranmu.</Text>
          <Button label="Ambil nomor" icon="add" onPress={() => navigation.navigate('Ambil')} style={styles.heroButton} secondary />
        </Card>
      ) : null}

      <View style={styles.statRow}>
        <Stat icon="storefront-outline" label="Layanan buka" value={data ? openCount : '-'} />
        <Stat icon="people-outline" label="Sedang menunggu" value={data ? waitingCount : '-'} />
      </View>

      <SectionTitle>Layanan hari ini</SectionTitle>
      {events.map((event) => (
        <Card key={event.id}>
          <View style={styles.eventHeading}>
            <View style={styles.prefix}><Text style={styles.prefixText}>{event.prefix}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.eventTitle}>{event.name}</Text>
              <Text style={styles.eventMeta}>{event.counterName} · {event.openHours}</Text>
            </View>
            <EventStatus status={event.status} />
          </View>
        </Card>
      ))}
      {!data && !error ? <Loader /> : null}
    </Screen>
  );
}

export function TakeQueueScreen({ session, navigation }) {
  const loader = useCallback(async () => {
    const [summary, mine] = await Promise.all([api.getSummary(), api.getMyQueues(session.id)]);
    return { summary, mine };
  }, [session.id]);
  const { data, error, setError, load, refresh, refreshing } = useLiveData(loader, 10000);
  const [loadingEvent, setLoadingEvent] = useState('');
  const [ticket, setTicket] = useState(null);
  const active = data?.mine.active;
  const events = (data?.summary.events || []).filter((event) => event.status !== 'closed');

  function confirmTake(event) {
    Alert.alert('Ambil nomor antrean?', `${event.name}\n${event.waitingCount} orang sedang menunggu.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ambil', onPress: () => takeQueue(event) },
    ]);
  }

  async function takeQueue(event) {
    setLoadingEvent(event.id);
    setError('');
    try {
      const created = await api.takeQueue(session.id, event.id);
      setTicket({ ...created, eventName: event.name });
      await load();
    } catch (takeError) {
      await load();
      setError(takeError.message);
    } finally {
      setLoadingEvent('');
    }
  }

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <PageTitle eyebrow="Ambil antrean" title="Pilih layanan" subtitle="Nomor dibuat langsung oleh server, berlaku untuk hari ini." />
      <ErrorMessage message={error} onRetry={load} />
      {active ? (
        <Notice
          icon="ticket-outline"
          title={`Kamu masih punya antrean ${active.ticket}`}
          message="Satu akun hanya bisa memegang satu antrean aktif."
          action={(
            <Pressable onPress={() => navigation.navigate('Antrean Saya')} hitSlop={8}>
              <Text style={styles.noticeLink}>Lihat antrean saya</Text>
            </Pressable>
          )}
        />
      ) : null}

      {events.map((event) => {
        const full = event.remainingQuota <= 0;
        const paused = event.status === 'paused';
        const ratio = event.dailyQuota ? Math.min(1, event.queueCount / event.dailyQuota) : 0;
        const label = paused ? 'Sedang dijeda' : full ? 'Kuota habis' : active ? 'Sudah punya antrean' : 'Ambil nomor';
        return (
          <Card key={event.id} style={styles.serviceCard}>
            <View style={styles.eventHeading}>
              <View style={styles.prefix}><Text style={styles.prefixText}>{event.prefix}</Text></View>
              <View style={styles.flex}>
                <Text style={styles.eventTitle}>{event.name}</Text>
                <Text style={styles.eventMeta}>{event.counterName}</Text>
              </View>
              <EventStatus status={full ? 'closed' : event.status} />
            </View>
            {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
            <View style={styles.metrics}>
              <View>
                <Text style={styles.metricValue}>{event.waitingCount}</Text>
                <Text style={styles.metricLabel}>menunggu</Text>
              </View>
              <View style={styles.metricDivider} />
              <View>
                <Text style={styles.metricValue}>{event.remainingQuota}</Text>
                <Text style={styles.metricLabel}>sisa kuota</Text>
              </View>
              <View style={styles.metricDivider} />
              <View>
                <Text style={styles.metricValue}>~{event.waitingCount * 4}m</Text>
                <Text style={styles.metricLabel}>estimasi</Text>
              </View>
            </View>
            <View style={styles.track}><View style={[styles.trackFill, { width: `${ratio * 100}%` }]} /></View>
            <Button
              label={label}
              icon={!paused && !full && !active ? 'add' : undefined}
              loading={loadingEvent === event.id}
              disabled={paused || full || Boolean(active) || Boolean(loadingEvent)}
              onPress={() => confirmTake(event)}
              style={styles.cardButton}
            />
          </Card>
        );
      })}
      {data && events.length === 0 ? (
        <EmptyState icon="moon-outline" title="Belum ada layanan dibuka" message="Coba lagi nanti atau hubungi bagian administrasi." />
      ) : null}
      {!data && !error ? <Loader /> : null}

      <Modal animationType="fade" transparent visible={Boolean(ticket)} onRequestClose={() => setTicket(null)}>
        <View style={styles.backdrop}>
          <View style={styles.ticket}>
            <View style={styles.ticketCheck}><Icon name="checkmark" size={24} color={theme.colors.success} /></View>
            <Text style={styles.ticketLabel}>NOMOR ANTREAN KAMU</Text>
            <Text style={styles.ticketNumber}>{ticket?.ticket}</Text>
            <Text style={styles.ticketService}>{ticket?.eventName}</Text>
            <View style={styles.perforation} />
            <View style={styles.ticketRow}>
              <View>
                <Text style={styles.ticketSmall}>Tanggal</Text>
                <Text style={styles.ticketValue}>{formatDate(ticket?.date)}</Text>
              </View>
              <View style={styles.alignEnd}>
                <Text style={styles.ticketSmall}>Diambil</Text>
                <Text style={styles.ticketValue}>{formatTime(ticket?.createdAt)}</Text>
              </View>
            </View>
            <Button
              label="Pantau antrean"
              icon="pulse"
              onPress={() => { setTicket(null); navigation.navigate('Antrean Saya'); }}
              style={styles.fullButton}
            />
            <Pressable onPress={() => setTicket(null)} style={styles.closeLink} hitSlop={8}>
              <Text style={styles.closeText}>Tutup</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

export function MyQueueScreen({ session, navigation }) {
  const loader = useCallback(() => api.getMyQueues(session.id), [session.id]);
  const { data, error, setError, load, refresh, refreshing } = useLiveData(loader, 5000);
  const [cancelling, setCancelling] = useState(false);
  const active = data?.active;
  const alerted = useRef({ near: null, called: null });

  const near = active && active.status === 'waiting' && active.aheadCount <= 3;
  const called = active && active.status === 'called';

  useEffect(() => {
    if (!active) return;
    if (called && alerted.current.called !== active.calledAt) {
      alerted.current.called = active.calledAt;
      Vibration.vibrate([0, 400, 200, 400]);
    } else if (near && alerted.current.near !== active.id) {
      alerted.current.near = active.id;
      Vibration.vibrate(300);
    }
  }, [active, near, called]);

  function cancel() {
    Alert.alert('Batalkan antrean?', `Nomor ${active.ticket} akan dibatalkan dan tidak bisa dipakai lagi.`, [
      { text: 'Kembali', style: 'cancel' },
      {
        text: 'Batalkan',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await api.cancelQueue(session.id, active.id);
            await load();
          } catch (cancelError) {
            setError(cancelError.message);
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <PageTitle
        eyebrow="Antrean saya"
        title={active ? active.eventName : 'Belum ada antrean'}
        right={active ? <View style={styles.live}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View> : null}
      />
      <ErrorMessage message={error} onRetry={load} />
      {!data && !error ? <Loader /> : null}

      {data && !active ? (
        <EmptyState
          icon="ticket-outline"
          title="Kamu belum mengambil nomor"
          message="Pilih layanan lalu pantau posisimu secara langsung dari halaman ini."
          action={<Button label="Ambil nomor" icon="add" onPress={() => navigation.navigate('Ambil')} />}
        />
      ) : null}

      {active ? (
        <>
          {called ? (
            <Notice
              icon="megaphone"
              tone="warning"
              title={`${active.ticket} silakan ke ${active.counterName}`}
              message="Nomormu sedang dipanggil petugas sekarang."
            />
          ) : active.status === 'serving' ? (
            <Notice icon="person" tone="accent" title="Kamu sedang dilayani" message={`Di ${active.counterName}.`} />
          ) : near ? (
            <Notice
              icon="notifications"
              tone="success"
              title="Giliranmu hampir tiba"
              message={active.aheadCount === 0 ? 'Kamu berikutnya. Bersiaplah menuju loket.' : `Tinggal ${active.aheadCount} orang lagi. Mulai menuju loket.`}
            />
          ) : null}

          <Card dark style={styles.bigTicket}>
            <Text style={styles.heroLabel}>NOMOR KAMU</Text>
            <Text style={styles.bigNumber}>{active.ticket}</Text>
            <Badge label={statusMeta[active.status].label} tone="dark" />
            <View style={styles.heroDivider} />
            <View style={styles.ticketGrid}>
              <View style={styles.flex}>
                <Text style={styles.gridLabel}>Sedang dipanggil</Text>
                <Text style={styles.gridValue}>{active.nowCalling || '-'}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.gridLabel}>Di depan kamu</Text>
                <Text style={styles.gridValue}>{active.status === 'waiting' ? active.aheadCount : 0}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.gridLabel}>Estimasi</Text>
                <Text style={styles.gridValue}>{active.status === 'waiting' ? `~${active.estimatedMinutes}m` : 'Sekarang'}</Text>
              </View>
            </View>
          </Card>

          <SectionTitle>Perjalanan antrean</SectionTitle>
          <Card>
            {[
              { key: 'waiting', label: 'Nomor diambil', time: active.createdAt },
              { key: 'called', label: 'Dipanggil ke loket', time: active.calledAt },
              { key: 'serving', label: 'Sedang dilayani', time: active.servedAt },
            ].map((step, index, steps) => {
              const order = ['waiting', 'called', 'serving'];
              const done = order.indexOf(active.status) >= index;
              return (
                <View key={step.key} style={styles.step}>
                  <View style={styles.stepRail}>
                    <View style={[styles.stepDot, done && styles.stepDotDone]} />
                    {index < steps.length - 1 ? <View style={[styles.stepLine, done && styles.stepLineDone]} /> : null}
                  </View>
                  <View style={styles.stepCopy}>
                    <Text style={[styles.stepLabel, !done && styles.stepMuted]}>{step.label}</Text>
                    <Text style={styles.stepTime}>{done ? formatTime(step.time) : 'Belum'}</Text>
                  </View>
                </View>
              );
            })}
          </Card>

          {active.status === 'waiting' ? (
            <Button label="Batalkan antrean" icon="close" danger loading={cancelling} onPress={cancel} />
          ) : null}
          <Text style={styles.footnote}>Diperbarui otomatis setiap 5 detik.</Text>
        </>
      ) : null}
    </Screen>
  );
}

export function HistoryScreen({ session }) {
  const loader = useCallback(() => api.getMyQueues(session.id), [session.id]);
  const { data, error, load, refresh, refreshing } = useLiveData(loader);
  const history = data?.history || [];
  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <PageTitle eyebrow="Riwayat" title="Antrean sebelumnya" subtitle={data ? `${history.length} catatan` : undefined} />
      <ErrorMessage message={error} onRetry={load} />
      {!data && !error ? <Loader /> : null}
      {data && history.length === 0 ? (
        <EmptyState icon="time-outline" title="Belum ada riwayat" message="Antrean yang selesai, dilewati, atau dibatalkan akan muncul di sini." />
      ) : null}
      {history.map((queue) => {
        const meta = statusMeta[queue.status] || statusMeta.cancelled;
        return (
          <Card key={queue.id} style={styles.historyCard}>
            <View style={styles.flex}>
              <Text style={styles.historyNumber}>{queue.ticket}</Text>
              <Text style={styles.eventMeta}>{queue.eventName}</Text>
              <Text style={styles.historyDate}>{formatDate(queue.date)} · {formatTime(queue.completedAt || queue.cancelledAt || queue.createdAt)}</Text>
            </View>
            <Badge label={meta.label} tone={meta.tone} />
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alignEnd: { alignItems: 'flex-end' },
  heroCard: { padding: 22, marginBottom: 16 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '600', lineHeight: 29, letterSpacing: -0.4, marginTop: 12 },
  heroNumber: { color: '#FFFFFF', fontSize: 52, fontWeight: '700', letterSpacing: -1.5, marginTop: 10 },
  heroMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 16, alignSelf: 'stretch' },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroButton: { marginTop: 20, borderWidth: 0 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  eventHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefix: { width: 42, height: 42, borderRadius: 12, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  prefixText: { color: theme.colors.text, fontSize: 17, fontWeight: '700' },
  eventTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  eventMeta: { color: theme.colors.muted, fontSize: 12, marginTop: 3 },
  serviceCard: { padding: 18 },
  description: { color: theme.colors.muted, fontSize: 13, lineHeight: 19, marginTop: 14 },
  metrics: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingHorizontal: 4 },
  metricValue: { color: theme.colors.text, fontSize: 19, fontWeight: '700', letterSpacing: -0.4 },
  metricLabel: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: theme.colors.border },
  track: { height: 4, borderRadius: 4, backgroundColor: theme.colors.background, overflow: 'hidden', marginTop: 16 },
  trackFill: { height: '100%', backgroundColor: theme.colors.ink, borderRadius: 4 },
  cardButton: { marginTop: 16 },
  noticeLink: { color: theme.colors.accent, fontSize: 13, fontWeight: '700', marginTop: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,12,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  ticket: { width: '100%', maxWidth: 380, alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 28, padding: 26 },
  ticketCheck: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.successSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  ticketLabel: { color: theme.colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  ticketNumber: { color: theme.colors.text, fontSize: 60, fontWeight: '700', letterSpacing: -2, marginTop: 6 },
  ticketService: { color: theme.colors.muted, fontSize: 15 },
  perforation: { alignSelf: 'stretch', borderTopWidth: 1.5, borderColor: theme.colors.border, borderStyle: 'dashed', marginVertical: 22 },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  ticketSmall: { color: theme.colors.muted, fontSize: 12 },
  ticketValue: { color: theme.colors.text, fontSize: 15, fontWeight: '600', marginTop: 3 },
  fullButton: { alignSelf: 'stretch', marginTop: 24 },
  closeLink: { marginTop: 14 },
  closeText: { color: theme.colors.muted, fontSize: 14, fontWeight: '600' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.successSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.success },
  liveText: { color: theme.colors.success, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  bigTicket: { alignItems: 'center', paddingVertical: 28, marginBottom: 18 },
  bigNumber: { color: '#FFFFFF', fontSize: 76, fontWeight: '700', letterSpacing: -3, marginVertical: 6 },
  ticketGrid: { flexDirection: 'row', alignSelf: 'stretch', gap: 8 },
  gridLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, textAlign: 'center' },
  gridValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  step: { flexDirection: 'row', gap: 14 },
  stepRail: { alignItems: 'center', width: 14 },
  stepDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, marginTop: 3 },
  stepDotDone: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  stepLine: { flex: 1, width: 2, backgroundColor: theme.colors.border, marginVertical: 3 },
  stepLineDone: { backgroundColor: theme.colors.ink },
  stepCopy: { flex: 1, paddingBottom: 18 },
  stepLabel: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  stepMuted: { color: theme.colors.faint },
  stepTime: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
  footnote: { color: theme.colors.faint, fontSize: 12, textAlign: 'center', marginTop: 16 },
  historyCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyNumber: { color: theme.colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  historyDate: { color: theme.colors.faint, fontSize: 12, marginTop: 6 },
});
