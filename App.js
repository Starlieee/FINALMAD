import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api } from './src/api';
import { Button, Card, Icon, PageTitle, Row, Screen } from './src/components';
import LoginScreen from './src/screens/LoginScreen';
import StaffControlScreen from './src/screens/StaffControlScreen';
import { HistoryScreen, HomeScreen, MyQueueScreen, TakeQueueScreen } from './src/screens/UserScreens';
import { ManageScreen, StatsScreen } from './src/screens/AdminScreens';
import theme from './src/theme';

const SESSION_KEY = 'campus-queue-session';
const Tab = createBottomTabNavigator();

const roleLabels = {
  user: 'Mahasiswa',
  petugas: 'Petugas loket',
  admin: 'Administrator',
};

function ProfileScreen({ session, onLogout }) {
  const [loggingOut, setLoggingOut] = useState(false);

  function logout() {
    Alert.alert('Keluar dari akun?', 'Kamu perlu masuk lagi untuk memakai aplikasi.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await onLogout();
          } catch (error) {
            setLoggingOut(false);
            Alert.alert('Tidak dapat keluar', error.message);
          }
        },
      },
    ]);
  }

  return (
    <Screen scroll>
      <PageTitle eyebrow="Akun" title="Profil" />
      <Card style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{session.name.charAt(0).toUpperCase()}</Text></View>
        <Text style={styles.profileName}>{session.name}</Text>
        <Text style={styles.profileRole}>{roleLabels[session.role] || session.role}</Text>
      </Card>
      <Card style={styles.infoCard}>
        <Row label="Email" value={session.email} />
        <Row label="Peran" value={roleLabels[session.role] || session.role} last={!session.studentId && session.role !== 'petugas'} />
        {session.studentId ? <Row label="NIM" value={session.studentId} last={session.role !== 'petugas'} /> : null}
        {session.role === 'petugas' ? <Row label="Loket tugas" value={session.assignedCounter || 'Belum ditentukan'} last /> : null}
      </Card>
      <Button label="Keluar" icon="log-out-outline" loading={loggingOut} onPress={logout} secondary />
      <Text style={styles.version}>Campus Queue · versi 1.0</Text>
    </Screen>
  );
}

const icons = {
  Beranda: 'home',
  Ambil: 'add-circle',
  'Antrean Saya': 'ticket',
  Riwayat: 'time',
  Kontrol: 'grid',
  Kelola: 'construct',
  Statistik: 'bar-chart',
  Profil: 'person-circle',
};

function tabsFor(session) {
  if (session.role === 'petugas') {
    return [
      { name: 'Kontrol', component: StaffControlScreen },
      { name: 'Beranda', component: HomeScreen },
    ];
  }
  if (session.role === 'admin') {
    return [
      { name: 'Statistik', component: StatsScreen },
      { name: 'Kontrol', component: StaffControlScreen },
      { name: 'Kelola', component: ManageScreen },
      { name: 'Ambil', component: TakeQueueScreen },
      { name: 'Antrean Saya', component: MyQueueScreen, hidden: true },
    ];
  }
  return [
    { name: 'Beranda', component: HomeScreen },
    { name: 'Ambil', component: TakeQueueScreen },
    { name: 'Antrean Saya', component: MyQueueScreen },
    { name: 'Riwayat', component: HistoryScreen },
  ];
}

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.colors.background } };

function RoleTabs({ session, onLogout }) {
  const tabs = tabsFor(session);
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: theme.colors.ink,
          tabBarInactiveTintColor: theme.colors.faint,
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: styles.tabBar,
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? icons[route.name] : `${icons[route.name]}-outline`} size={22} color={color} />
          ),
        })}
      >
        {tabs.map((tab) => (
          <Tab.Screen
            key={tab.name}
            name={tab.name}
            options={tab.hidden ? { tabBarButton: () => null, tabBarItemStyle: { display: 'none' } } : undefined}
          >
            {(props) => <tab.component {...props} session={session} />}
          </Tab.Screen>
        ))}
        <Tab.Screen name="Profil">
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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      {loading ? (
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={theme.colors.ink} size="large" />
        </View>
      ) : session ? (
        <RoleTabs session={session} onLogout={logout} />
      ) : (
        <LoginScreen onLogin={login} startupError={startupError} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  profileCard: { alignItems: 'center', paddingVertical: 28 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  profileName: { color: theme.colors.text, fontSize: 20, fontWeight: '700', marginTop: 14, letterSpacing: -0.3 },
  profileRole: { color: theme.colors.muted, fontSize: 13, marginTop: 4 },
  infoCard: { paddingVertical: 4, marginBottom: 20 },
  version: { color: theme.colors.faint, fontSize: 12, textAlign: 'center', marginTop: 20 },
  tabBar: { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  tabLabel: { fontSize: 11, fontWeight: '600' },
});
