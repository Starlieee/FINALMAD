import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { api } from './src/api';
import { Badge, Button, Card, ErrorMessage, PageTitle, Screen } from './src/components';
import StaffControlScreen from './src/screens/StaffControlScreen';
import theme from './src/theme';

const SESSION_KEY = 'campus-queue-session';
const Tab = createBottomTabNavigator();

const roleLabels = {
  user: 'Mahasiswa',
  petugas: 'Petugas',
  admin: 'Administrator',
};

function LoginScreen({ onLogin, startupError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(startupError || '');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Masukkan email dan kata sandi terlebih dahulu.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>CQ</Text>
        </View>
        <Text style={styles.loginEyebrow}>LAYANAN KAMPUS</Text>
        <Text style={styles.loginTitle}>Antre lebih mudah.</Text>
        <Text style={styles.loginSubtitle}>
          Masuk untuk mengakses layanan kampus tanpa perlu menunggu lama.
        </Text>

        <Card style={styles.loginCard}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="nama@kampus.id"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            value={email}
          />
          <Text style={[styles.fieldLabel, styles.passwordLabel]}>Kata sandi</Text>
          <TextInput
            accessibilityLabel="Kata sandi"
            autoCapitalize="none"
            onChangeText={setPassword}
            onSubmitEditing={submit}
            placeholder="Masukkan kata sandi"
            placeholderTextColor={theme.colors.muted}
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <ErrorMessage message={error} />
          <Button label="Masuk ke akun" loading={loading} onPress={submit} />
        </Card>
        <Text style={styles.demoHint}>Demo: user@kampus.id / user123</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeScreen({ session }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function loadSummary() {
    setError('');
    try {
      setSummary(await api.getSummary());
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  async function refresh() {
    setRefreshing(true);
    await loadSummary();
    setRefreshing(false);
  }

  const openCount = summary?.events.filter((event) => event.status === 'open').length || 0;
  const waitingCount = summary?.events.reduce((sum, event) => sum + event.waitingCount, 0) || 0;

  return (
    <Screen scroll>
      <PageTitle eyebrow="CAMPUS QUEUE" title={`Halo, ${session.name.split(' ')[0]}`} subtitle="Semua layanan kampus, dalam satu genggaman." />
      <ErrorMessage message={error} onRetry={loadSummary} />
      <Card style={styles.welcomeCard}>
        <View style={styles.welcomeTop}>
          <View style={styles.welcomeCopy}>
            <Text style={styles.welcomeEyebrow}>HARI INI</Text>
            <Text style={styles.welcomeTitle}>Urusan kampus{'\n'}jadi lebih ringkas.</Text>
          </View>
          <Text style={styles.welcomeIcon}>✦</Text>
        </View>
        <Text style={styles.welcomeDescription}>Ambil nomor antrean dan pantau layanan langsung dari aplikasi.</Text>
      </Card>

      <Text style={styles.sectionTitle}>Ringkasan layanan</Text>
      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{summary ? openCount : '—'}</Text>
          <Text style={styles.statLabel}>Layanan buka</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{summary ? waitingCount : '—'}</Text>
          <Text style={styles.statLabel}>Antrean menunggu</Text>
        </Card>
      </View>

      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionTitle}>Layanan tersedia</Text>
        <Pressable onPress={refresh} accessibilityRole="button">
          <Text style={styles.refreshText}>{refreshing ? 'Memuat…' : 'Perbarui'}</Text>
        </Pressable>
      </View>
      {summary?.events.map((event) => (
        <Card key={event.id} style={styles.eventCard}>
          <View style={styles.eventHeading}>
            <View style={styles.eventTitleWrap}>
              <Text style={styles.eventTitle}>{event.name}</Text>
              <Text style={styles.eventCounter}>{event.counterName} · {event.openHours}</Text>
            </View>
            <Badge label={event.status === 'open' ? 'BUKA' : 'TUTUP'} tone={event.status === 'open' ? 'success' : 'warning'} />
          </View>
          <Text style={styles.eventDescription}>{event.description}</Text>
        </Card>
      ))}
      {!summary && !error ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}
    </Screen>
  );
}

function TakeQueueScreen({ session }) {
  const [summary, setSummary] = useState(null);
  const [queues, setQueues] = useState([]);
  const [error, setError] = useState('');
  const [loadingEvent, setLoadingEvent] = useState('');
  const [ticket, setTicket] = useState(null);

  async function loadData() {
    setError('');
    try {
      const [nextSummary, allQueues] = await Promise.all([api.getSummary(), api.getQueues()]);
      setSummary(nextSummary);
      setQueues(allQueues.filter((queue) => queue.userId === session.id && queue.date === nextSummary.date));
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function takeQueue(event) {
    setLoadingEvent(event.id);
    setError('');
    try {
      const createdTicket = await api.takeQueue(session.id, event.id);
      setTicket(createdTicket);
      await loadData();
    } catch (takeError) {
      await loadData();
      setError(takeError.message);
    } finally {
      setLoadingEvent('');
    }
  }

  return (
    <Screen scroll>
      <PageTitle eyebrow="ANTREAN ONLINE" title="Ambil antrean" subtitle="Pilih layanan yang ingin kamu tuju hari ini." />
      <ErrorMessage message={error} onRetry={loadData} />
      {queues.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Antrean saya hari ini</Text>
          {queues.map((queue) => (
            <Card key={queue.id} style={styles.myQueueCard}>
              <View>
                <Text style={styles.ticketNumberSmall}>{queue.ticket}</Text>
                <Text style={styles.myQueueMeta}>Nomor antrean · {queue.status === 'waiting' ? 'Menunggu' : queue.status}</Text>
              </View>
              <Badge label={queue.status === 'waiting' ? 'MENUNGGU' : queue.status.toUpperCase()} />
            </Card>
          ))}
        </>
      ) : null}
      <Text style={styles.sectionTitle}>Pilih layanan</Text>
      {summary?.events.filter((event) => event.status === 'open').map((event) => {
        const alreadyHasQueue = queues.some((queue) => queue.eventId === event.id);
        const unavailable = event.remainingQuota <= 0;
        return (
          <Card key={event.id} style={styles.serviceCard}>
            <View style={styles.eventHeading}>
              <View style={styles.eventTitleWrap}>
                <Text style={styles.eventTitle}>{event.name}</Text>
                <Text style={styles.eventCounter}>{event.counterName}</Text>
              </View>
              <Badge label={unavailable ? 'PENUH' : 'BUKA'} tone={unavailable ? 'danger' : 'success'} />
            </View>
            <Text style={styles.eventDescription}>{event.description}</Text>
            <View style={styles.quotaRow}>
              <Text style={styles.quotaText}>Sisa kuota hari ini</Text>
              <Text style={styles.quotaValue}>{event.remainingQuota} / {event.dailyQuota}</Text>
            </View>
            <View style={styles.quotaTrack}>
              <View style={[styles.quotaFill, { width: `${Math.min(100, (event.queueCount / event.dailyQuota) * 100)}%` }]} />
            </View>
            <Text style={styles.waitingText}>{event.waitingCount} antrean sedang menunggu</Text>
            <Button
              label={alreadyHasQueue ? 'Nomor sudah diambil' : unavailable ? 'Kuota hari ini habis' : 'Ambil nomor antrean'}
              loading={loadingEvent === event.id}
              disabled={alreadyHasQueue || unavailable || Boolean(loadingEvent)}
              onPress={() => takeQueue(event)}
              style={styles.takeButton}
            />
          </Card>
        );
      })}
      {!summary && !error ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}
      {summary && !summary.events.some((event) => event.status === 'open') ? (
        <Card><Text style={styles.emptyText}>Belum ada layanan yang dibuka saat ini.</Text></Card>
      ) : null}
      <Modal animationType="fade" transparent visible={Boolean(ticket)} onRequestClose={() => setTicket(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.ticketModal}>
            <Pressable onPress={() => setTicket(null)} style={styles.modalClose} accessibilityRole="button">
              <Text style={styles.modalCloseText}>×</Text>
            </Pressable>
            <View style={styles.ticketMark}><Text style={styles.ticketMarkText}>✓</Text></View>
            <Text style={styles.ticketEyebrow}>NOMOR ANTREAN KAMU</Text>
            <Text style={styles.ticketNumber}>{ticket?.ticket}</Text>
            <Text style={styles.ticketService}>{summary?.events.find((event) => event.id === ticket?.eventId)?.name}</Text>
            <Text style={styles.ticketDate}>Berlaku hari ini · {ticket?.date}</Text>
            <View style={styles.ticketDivider} />
            <Text style={styles.ticketStatus}>Simpan nomor ini dan pantau panggilan petugas.</Text>
            <Button label="Selesai" onPress={() => setTicket(null)} style={styles.modalButton} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function AdminScreen() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  async function loadSummary() {
    setError('');
    try {
      setSummary(await api.getSummary());
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  const totalWaiting = summary?.events.reduce((sum, event) => sum + event.waitingCount, 0) || 0;
  const totalQuota = summary?.events.reduce((sum, event) => sum + event.dailyQuota, 0) || 0;
  const usedQuota = summary?.events.reduce((sum, event) => sum + event.queueCount, 0) || 0;

  return (
    <Screen scroll>
      <PageTitle eyebrow="PANEL ADMIN" title="Ringkasan layanan" subtitle="Pantau operasional antrean kampus hari ini." right={<Pressable onPress={loadSummary}><Text style={styles.refreshText}>Perbarui</Text></Pressable>} />
      <ErrorMessage message={error} onRetry={loadSummary} />
      <Card style={styles.adminSummary}>
        <Text style={styles.adminLabel}>ANTREAN MENUNGGU</Text>
        <Text style={styles.adminTotal}>{summary ? totalWaiting : '—'}</Text>
        <Text style={styles.adminFootnote}>dari {usedQuota} nomor yang diambil hari ini</Text>
      </Card>
      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{summary ? summary.events.filter((event) => event.status === 'open').length : '—'}</Text>
          <Text style={styles.statLabel}>Layanan buka</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{summary ? totalQuota - usedQuota : '—'}</Text>
          <Text style={styles.statLabel}>Sisa kuota total</Text>
        </Card>
      </View>
      <Text style={styles.sectionTitle}>Status per layanan</Text>
      {summary?.events.map((event) => (
        <Card key={event.id} style={styles.eventCard}>
          <View style={styles.eventHeading}>
            <View style={styles.eventTitleWrap}>
              <Text style={styles.eventTitle}>{event.name}</Text>
              <Text style={styles.eventCounter}>{event.counterName}</Text>
            </View>
            <Badge label={event.status === 'open' ? 'BUKA' : 'TUTUP'} tone={event.status === 'open' ? 'success' : 'warning'} />
          </View>
          <View style={styles.quotaRow}>
            <Text style={styles.quotaText}>Antrean menunggu</Text>
            <Text style={styles.quotaValue}>{event.waitingCount}</Text>
          </View>
          <View style={styles.quotaRow}>
            <Text style={styles.quotaText}>Kuota tersisa</Text>
            <Text style={styles.quotaValue}>{event.remainingQuota} / {event.dailyQuota}</Text>
          </View>
        </Card>
      ))}
      {!summary && !error ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}
    </Screen>
  );
}

function ProfileScreen({ session, onLogout }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } catch (error) {
      Alert.alert('Tidak dapat keluar', error.message);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Screen scroll>
      <PageTitle eyebrow="AKUN SAYA" title="Profil" subtitle="Informasi akun dan akses layanan." />
      <Card style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{session.name.charAt(0).toUpperCase()}</Text></View>
        <Text style={styles.profileName}>{session.name}</Text>
        <Text style={styles.profileRole}>{roleLabels[session.role] || session.role}</Text>
      </Card>
      <Text style={styles.sectionTitle}>Informasi akun</Text>
      <Card style={styles.infoCard}>
        <InfoRow label="Nama lengkap" value={session.name} />
        <InfoRow label="Email" value={session.email} />
        <InfoRow label="Peran akun" value={roleLabels[session.role] || session.role} />
        {session.studentId ? <InfoRow label="NIM" value={session.studentId} /> : null}
        {session.role === 'petugas' ? <InfoRow label="Loket tugas" value={session.assignedCounter || 'Belum ditentukan'} last /> : null}
      </Card>
      <Button label="Keluar dari akun" loading={loggingOut} onPress={logout} secondary />
    </Screen>
  );
}

function InfoRow({ label, value, last = false }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function RoleTabs({ session, onLogout }) {
  const tabs =
    session.role === 'petugas'
      ? [
          { name: 'Beranda', title: 'Beranda', icon: '⌂', component: HomeScreen, props: { session } },
          { name: 'Kontrol Antrean', title: 'Kontrol Antrean', icon: '≋', component: StaffControlScreen, props: { session } },
        ]
      : session.role === 'admin'
        ? [
            { name: 'Ringkasan', title: 'Ringkasan', icon: '▦', component: AdminScreen, props: {} },
            { name: 'Layanan', title: 'Layanan', icon: '◷', component: HomeScreen, props: { session } },
          ]
        : [
            { name: 'Beranda', title: 'Beranda', icon: '⌂', component: HomeScreen, props: { session } },
            { name: 'Antrean', title: 'Antrean', icon: '≋', component: TakeQueueScreen, props: { session } },
          ];

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.muted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
        }}
      >
        {tabs.map((tab) => (
          <Tab.Screen key={tab.name} name={tab.name} options={{ tabBarLabel: tab.title, tabBarIcon: () => <Text style={styles.tabIcon}>{tab.icon}</Text> }}>
            {(props) => <tab.component {...props} {...tab.props} />}
          </Tab.Screen>
        ))}
        <Tab.Screen name="Profil" options={{ tabBarLabel: 'Profil', tabBarIcon: () => <Text style={styles.tabIcon}>◉</Text> }}>
          {() => <ProfileScreen session={session} onLogout={onLogout} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY)
      .then((storedSession) => {
        if (storedSession) setSession(JSON.parse(storedSession));
      })
      .catch((error) => setStartupError(`Sesi tidak dapat dibaca: ${error.message}`))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const user = await api.login(email, password);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setSession(user);
  }

  async function logout() {
    await AsyncStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return session
    ? <RoleTabs session={session} onLogout={logout} />
    : <LoginScreen onLogin={login} startupError={startupError} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  loginContent: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingVertical: 36 },
  brandMark: { width: 58, height: 58, borderRadius: 19, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  brandMarkText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  loginEyebrow: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  loginTitle: { color: theme.colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  loginSubtitle: { color: theme.colors.muted, fontSize: 15, lineHeight: 23, marginTop: 10, maxWidth: 330 },
  loginCard: { marginTop: 30, padding: 20 },
  fieldLabel: { color: theme.colors.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  passwordLabel: { marginTop: 16 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, height: 50, color: theme.colors.text, fontSize: 14, paddingHorizontal: 14, backgroundColor: '#FFFFFF' },
  demoHint: { color: theme.colors.muted, textAlign: 'center', fontSize: 12, marginTop: 16 },
  welcomeCard: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, padding: 20, overflow: 'hidden' },
  welcomeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  welcomeCopy: { flex: 1 },
  welcomeEyebrow: { color: '#D9E1FF', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 9 },
  welcomeTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '800', lineHeight: 29 },
  welcomeIcon: { color: '#C6D1FF', fontSize: 38, fontWeight: '700', marginRight: 4 },
  welcomeDescription: { color: '#E1E7FF', fontSize: 13, lineHeight: 19, marginTop: 18, maxWidth: 280 },
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '800', marginBottom: 12, marginTop: 6 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  statCard: { flex: 1, marginBottom: 0, paddingVertical: 16 },
  statValue: { color: theme.colors.text, fontSize: 24, fontWeight: '900' },
  statLabel: { color: theme.colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 12 },
  refreshText: { color: theme.colors.primary, fontSize: 12, fontWeight: '800' },
  eventCard: { padding: 16 },
  eventHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  eventTitleWrap: { flex: 1 },
  eventTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  eventCounter: { color: theme.colors.muted, fontSize: 11, marginTop: 4 },
  eventDescription: { color: theme.colors.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  loader: { marginVertical: 28 },
  serviceCard: { padding: 17 },
  quotaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  quotaText: { color: theme.colors.muted, fontSize: 12 },
  quotaValue: { color: theme.colors.text, fontSize: 12, fontWeight: '800' },
  quotaTrack: { height: 6, borderRadius: 8, backgroundColor: theme.colors.primarySoft, overflow: 'hidden', marginTop: 8 },
  quotaFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 8 },
  waitingText: { color: theme.colors.muted, fontSize: 11, marginTop: 10 },
  takeButton: { marginTop: 16 },
  myQueueCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15 },
  ticketNumberSmall: { color: theme.colors.primary, fontSize: 20, fontWeight: '900', letterSpacing: 0.4 },
  myQueueMeta: { color: theme.colors.muted, fontSize: 11, marginTop: 4 },
  emptyText: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17, 29, 55, 0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  ticketModal: { width: '100%', maxWidth: 380, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, paddingTop: 32 },
  modalClose: { position: 'absolute', right: 15, top: 10, paddingHorizontal: 8, paddingVertical: 2 },
  modalCloseText: { color: theme.colors.muted, fontSize: 28 },
  ticketMark: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.successSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  ticketMarkText: { color: theme.colors.success, fontSize: 23, fontWeight: '800' },
  ticketEyebrow: { color: theme.colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  ticketNumber: { color: theme.colors.primary, fontSize: 46, fontWeight: '900', letterSpacing: 1, marginTop: 7 },
  ticketService: { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginTop: 3 },
  ticketDate: { color: theme.colors.muted, fontSize: 12, marginTop: 8 },
  ticketDivider: { width: '100%', borderTopWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed', marginVertical: 20 },
  ticketStatus: { color: theme.colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  modalButton: { width: '100%', marginTop: 21 },
  adminSummary: { backgroundColor: theme.colors.text, borderColor: theme.colors.text, padding: 22 },
  adminLabel: { color: '#C5CEE2', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  adminTotal: { color: '#FFFFFF', fontSize: 42, fontWeight: '900', marginTop: 8 },
  adminFootnote: { color: '#C5CEE2', fontSize: 12, marginTop: 2 },
  profileCard: { alignItems: 'center', paddingVertical: 26 },
  avatar: { width: 68, height: 68, borderRadius: 24, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.colors.primary, fontSize: 28, fontWeight: '900' },
  profileName: { color: theme.colors.text, fontSize: 19, fontWeight: '800', marginTop: 13 },
  profileRole: { color: theme.colors.muted, fontSize: 13, marginTop: 4 },
  infoCard: { paddingVertical: 3, marginBottom: 22 },
  infoRow: { paddingVertical: 14 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  infoLabel: { color: theme.colors.muted, fontSize: 11 },
  infoValue: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginTop: 5 },
  tabBar: { height: 68, paddingTop: 7, paddingBottom: 7, borderTopColor: theme.colors.border, backgroundColor: '#FFFFFF' },
  tabItem: { paddingTop: 1 },
  tabLabel: { fontSize: 10, fontWeight: '700' },
  tabIcon: { color: theme.colors.primary, fontSize: 18, lineHeight: 20 },
});
