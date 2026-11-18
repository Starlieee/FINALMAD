import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import {
  Badge, Button, Card, EmptyState, ErrorMessage, Field, Icon, Loader, PageTitle, Screen, SectionTitle, Segmented, Stat,
} from '../components';
import { formatDate, useLiveData } from '../hooks';
import theme, { eventStatusMeta } from '../theme';

function Sheet({ visible, title, onClose, children }) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetBackdrop}>
        <Pressable style={styles.flex} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Icon name="close" size={22} color={theme.colors.muted} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const emptyEvent = { name: '', prefix: '', dailyQuota: '30', description: '', counterName: '', openHours: '08.00 - 15.00' };

function EventsPanel({ session }) {
  const loader = useCallback(() => api.getSummary(), []);
  const { data, error, load, refresh, refreshing } = useLiveData(loader);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');

  function openForm(event) {
    setFormError('');
    setForm(event
      ? { id: event.id, name: event.name, prefix: event.prefix, dailyQuota: String(event.dailyQuota), description: event.description || '', counterName: event.counterName || '', openHours: event.openHours || '' }
      : { ...emptyEvent });
  }

  async function save() {
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, dailyQuota: Number(form.dailyQuota) };
      delete payload.id;
      if (!payload.counterName) delete payload.counterName;
      if (form.id) await api.updateEvent(session.id, form.id, payload);
      else await api.createEvent(session.id, payload);
      setForm(null);
      await load();
    } catch (saveError) {
      setFormError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(event, status) {
    const apply = async () => {
      setBusyId(event.id);
      try {
        const result = await api.updateEvent(session.id, event.id, { status });
        if (result.cancelledCount) {
          Alert.alert('Layanan ditutup', `${result.cancelledCount} antrean yang menunggu ditandai dibatalkan.`);
        }
        await load();
      } catch (statusError) {
        Alert.alert('Gagal mengubah status', statusError.message);
      } finally {
        setBusyId('');
      }
    };
    if (status === 'closed' && event.waitingCount > 0) {
      Alert.alert('Tutup layanan?', `${event.waitingCount} antrean yang masih menunggu akan dibatalkan.`, [
        { text: 'Batal', style: 'cancel' },
        { text: 'Tutup layanan', style: 'destructive', onPress: apply },
      ]);
    } else {
      apply();
    }
  }

  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} showsVerticalScrollIndicator={false} contentContainerStyle={styles.panelContent}>
      <ErrorMessage message={error} onRetry={load} />
      <Button label="Tambah layanan" icon="add" onPress={() => openForm(null)} style={styles.addButton} />
      {!data && !error ? <Loader /> : null}
      {data?.events.map((event) => (
        <Card key={event.id}>
          <View style={styles.cardHead}>
            <View style={styles.prefix}><Text style={styles.prefixText}>{event.prefix}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{event.name}</Text>
              <Text style={styles.cardMeta}>{event.counterName} · kuota {event.dailyQuota}/hari</Text>
            </View>
            <Pressable onPress={() => openForm(event)} hitSlop={10} accessibilityLabel={`Ubah ${event.name}`}>
              <Icon name="create-outline" size={20} color={theme.colors.muted} />
            </Pressable>
          </View>
          <View style={styles.inlineStats}>
            <Text style={styles.inlineStat}><Text style={styles.inlineStrong}>{event.queueCount}</Text> diambil</Text>
            <Text style={styles.inlineStat}><Text style={styles.inlineStrong}>{event.waitingCount}</Text> menunggu</Text>
            <Text style={styles.inlineStat}><Text style={styles.inlineStrong}>{event.remainingQuota}</Text> sisa</Text>
          </View>
          <Segmented
            value={event.status}
            onChange={(status) => (status !== event.status && busyId !== event.id ? setStatus(event, status) : null)}
            options={['open', 'paused', 'closed'].map((value) => ({ value, label: eventStatusMeta[value].label }))}
          />
        </Card>
      ))}

      <Sheet visible={Boolean(form)} title={form?.id ? 'Ubah layanan' : 'Layanan baru'} onClose={() => setForm(null)}>
        {form ? (
          <>
            <Field label="Nama layanan" value={form.name} onChangeText={update('name')} placeholder="Pendaftaran Mahasiswa Baru" />
            <View style={styles.twoCol}>
              <Field label="Prefix" value={form.prefix} onChangeText={update('prefix')} placeholder="A" autoCapitalize="characters" maxLength={1} style={styles.flex} />
              <Field label="Kuota per hari" value={form.dailyQuota} onChangeText={update('dailyQuota')} keyboardType="number-pad" style={styles.flex} />
            </View>
            <Field label="Nama loket" value={form.counterName} onChangeText={update('counterName')} placeholder="Loket Pendaftaran" />
            <Field label="Jam layanan" value={form.openHours} onChangeText={update('openHours')} placeholder="08.00 - 15.00" />
            <Field label="Deskripsi singkat" value={form.description} onChangeText={update('description')} multiline style={styles.multiline} />
            <ErrorMessage message={formError} />
            <Button label={form.id ? 'Simpan perubahan' : 'Buat layanan'} loading={saving} onPress={save} />
          </>
        ) : null}
      </Sheet>
    </ScrollView>
  );
}

function StaffPanel({ session }) {
  const loader = useCallback(async () => {
    const [staff, summary] = await Promise.all([api.getStaff(session.id), api.getSummary()]);
    return { staff, counters: [...new Set(summary.events.map((event) => event.counterName).filter(Boolean))] };
  }, [session.id]);
  const { data, error, load, refresh, refreshing } = useLiveData(loader);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setFormError('');
    try {
      await api.createStaff(session.id, form);
      setForm(null);
      await load();
    } catch (saveError) {
      setFormError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  function chooseCounter(staff) {
    const options = (data?.counters || []).map((counter) => ({
      text: counter,
      onPress: async () => {
        try {
          await api.assignStaff(session.id, staff.id, counter);
          await load();
        } catch (assignError) {
          Alert.alert('Gagal menugaskan', assignError.message);
        }
      },
    }));
    Alert.alert('Tugaskan ke loket', staff.name, [...options, { text: 'Batal', style: 'cancel' }]);
  }

  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} showsVerticalScrollIndicator={false} contentContainerStyle={styles.panelContent}>
      <ErrorMessage message={error} onRetry={load} />
      <Button
        label="Tambah petugas"
        icon="person-add-outline"
        onPress={() => { setFormError(''); setForm({ name: '', email: '', password: '', assignedCounter: data?.counters[0] || '' }); }}
        style={styles.addButton}
      />
      {!data && !error ? <Loader /> : null}
      {data && data.staff.length === 0 ? <EmptyState icon="people-outline" title="Belum ada petugas" /> : null}
      {data?.staff.map((staff) => (
        <Card key={staff.id} style={styles.staffCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{staff.name.charAt(0).toUpperCase()}</Text></View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{staff.name}</Text>
            <Text style={styles.cardMeta}>{staff.email}</Text>
            <Pressable onPress={() => chooseCounter(staff)} style={styles.counterPill} hitSlop={6}>
              <Icon name="business-outline" size={13} color={theme.colors.text} />
              <Text style={styles.counterPillText}>{staff.assignedCounter || 'Belum ditugaskan'}</Text>
              <Icon name="chevron-down" size={13} color={theme.colors.muted} />
            </Pressable>
          </View>
        </Card>
      ))}

      <Sheet visible={Boolean(form)} title="Petugas baru" onClose={() => setForm(null)}>
        {form ? (
          <>
            <Field label="Nama lengkap" value={form.name} onChangeText={update('name')} placeholder="Nama petugas" />
            <Field label="Email" value={form.email} onChangeText={update('email')} autoCapitalize="none" keyboardType="email-address" placeholder="nama@kampus.id" />
            <Field label="Kata sandi awal" value={form.password} onChangeText={update('password')} secureTextEntry placeholder="Minimal 6 karakter" />
            <Text style={styles.chipLabel}>Loket</Text>
            <View style={styles.chips}>
              {data?.counters.map((counter) => (
                <Pressable
                  key={counter}
                  onPress={() => update('assignedCounter')(counter)}
                  style={[styles.chip, form.assignedCounter === counter && styles.chipActive]}
                >
                  <Text style={[styles.chipText, form.assignedCounter === counter && styles.chipTextActive]}>{counter}</Text>
                </Pressable>
              ))}
            </View>
            <ErrorMessage message={formError} />
            <Button label="Simpan petugas" loading={saving} onPress={save} />
          </>
        ) : null}
      </Sheet>
    </ScrollView>
  );
}

export function ManageScreen({ session }) {
  const [tab, setTab] = useState('events');
  return (
    <Screen>
      <PageTitle eyebrow="Kelola" title={tab === 'events' ? 'Layanan' : 'Petugas'} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[{ value: 'events', label: 'Layanan' }, { value: 'staff', label: 'Petugas & loket' }]}
      />
      {tab === 'events' ? <EventsPanel session={session} /> : <StaffPanel session={session} />}
    </Screen>
  );
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds < 60) return `${seconds} dtk`;
  return `${Math.round(seconds / 60)} mnt`;
}

export function StatsScreen({ session }) {
  const loader = useCallback(() => api.getStats(session.id), [session.id]);
  const { data, error, load, refresh, refreshing } = useLiveData(loader, 10000);
  const totals = data?.totals;
  const doneRate = totals && totals.total ? Math.round((totals.completed / totals.total) * 100) : 0;

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <PageTitle eyebrow="Statistik" title="Hari ini" subtitle={data ? formatDate(data.date) : undefined} />
      <ErrorMessage message={error} onRetry={load} />
      {!data && !error ? <Loader /> : null}
      {data ? (
        <>
          <Card dark style={styles.totalCard}>
            <Text style={styles.darkLabel}>TOTAL ANTREAN</Text>
            <Text style={styles.totalValue}>{totals.total}</Text>
            <View style={styles.progress}><View style={[styles.progressFill, { width: `${doneRate}%` }]} /></View>
            <Text style={styles.darkMeta}>{doneRate}% sudah selesai dilayani</Text>
          </Card>
          <View style={styles.statGrid}>
            <Stat icon="checkmark-circle-outline" label="Selesai" value={totals.completed} />
            <Stat icon="hourglass-outline" label="Menunggu" value={totals.waiting} />
          </View>
          <View style={styles.statGrid}>
            <Stat icon="play-skip-forward-outline" label="Dilewati" value={totals.skipped} />
            <Stat icon="close-circle-outline" label="Dibatalkan" value={totals.cancelled} />
          </View>

          <SectionTitle>Per layanan</SectionTitle>
          {data.events.map((event) => {
            const meta = eventStatusMeta[event.status] || eventStatusMeta.closed;
            return (
              <Card key={event.id}>
                <View style={styles.cardHead}>
                  <View style={styles.prefix}><Text style={styles.prefixText}>{event.prefix}</Text></View>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>{event.name}</Text>
                    <Text style={styles.cardMeta}>{event.total} dari {event.dailyQuota} kuota</Text>
                  </View>
                  <Badge label={meta.label} tone={meta.tone} />
                </View>
                <View style={styles.statTable}>
                  {[
                    ['Selesai', event.completed],
                    ['Dilewati', event.skipped],
                    ['Batal', event.cancelled],
                    ['Rata-rata', formatDuration(event.avgServiceSeconds)],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.statCell}>
                      <Text style={styles.cellValue}>{value}</Text>
                      <Text style={styles.cellLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panelContent: { paddingBottom: 40 },
  addButton: { marginBottom: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefix: { width: 42, height: 42, borderRadius: 12, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  prefixText: { color: theme.colors.text, fontSize: 17, fontWeight: '700' },
  cardTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  cardMeta: { color: theme.colors.muted, fontSize: 12, marginTop: 3 },
  inlineStats: { flexDirection: 'row', gap: 16, marginTop: 14, marginBottom: 14 },
  inlineStat: { color: theme.colors.muted, fontSize: 13 },
  inlineStrong: { color: theme.colors.text, fontWeight: '700' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(10,10,12,0.5)' },
  sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingTop: 10, maxHeight: '88%' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sheetTitle: { color: theme.colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  twoCol: { flexDirection: 'row', gap: 12 },
  multiline: {},
  staffCard: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  counterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10, backgroundColor: theme.colors.background, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  counterPillText: { color: theme.colors.text, fontSize: 12, fontWeight: '600' },
  chipLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  chipText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  totalCard: { padding: 22, marginBottom: 12 },
  darkLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  totalValue: { color: '#FFFFFF', fontSize: 56, fontWeight: '700', letterSpacing: -2, marginTop: 6 },
  progress: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', marginTop: 14 },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 3 },
  darkMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 10 },
  statGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statTable: { flexDirection: 'row', marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: 14 },
  statCell: { flex: 1, alignItems: 'center' },
  cellValue: { color: theme.colors.text, fontSize: 17, fontWeight: '700' },
  cellLabel: { color: theme.colors.muted, fontSize: 11, marginTop: 3 },
});
