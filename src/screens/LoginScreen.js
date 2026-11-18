import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorMessage, Icon } from '../components';
import theme from '../theme';

const demoAccounts = [
  { role: 'Mahasiswa', icon: 'school-outline', email: 'user@kampus.id', password: 'user123' },
  { role: 'Petugas', icon: 'id-card-outline', email: 'petugas@kampus.id', password: 'staff123' },
  { role: 'Admin', icon: 'shield-checkmark-outline', email: 'admin@kampus.id', password: 'admin123' },
];

const boardCounters = ['Loket Akademik', 'Loket Keuangan', 'Loket Akademik', 'Loket Kemahasiswaan'];

function ticketLabel(number) {
  return `A-${String(number).padStart(3, '0')}`;
}

// Kartu "papan antrean" yang bergerak sendiri, memberi gambaran cara kerja aplikasi.
function LiveBoard() {
  const [number, setNumber] = useState(12);
  const swap = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(swap, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setNumber((current) => (current >= 19 ? 12 : current + 1));
        Animated.spring(swap, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
      });
    }, 2600);
    return () => clearInterval(timer);
  }, [swap]);

  const numberStyle = {
    opacity: swap,
    transform: [{ translateY: swap.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  };
  const ringStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
  };

  return (
    <View style={styles.board}>
      <View style={styles.boardGlow} />
      <View style={styles.boardTop}>
        <View style={styles.liveWrap}>
          <View style={styles.liveDotWrap}>
            <Animated.View style={[styles.liveRing, ringStyle]} />
            <View style={styles.liveDot} />
          </View>
          <Text style={styles.liveText}>SEDANG DIPANGGIL</Text>
        </View>
        <Icon name="radio-outline" size={18} color="rgba(255,255,255,0.5)" />
      </View>

      <Animated.View style={numberStyle}>
        <Text style={styles.boardNumber}>{ticketLabel(number)}</Text>
        <View style={styles.counterRow}>
          <Icon name="location-outline" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={styles.boardCounter}>{boardCounters[number % boardCounters.length]}</Text>
        </View>
      </Animated.View>

      <View style={styles.boardDivider} />
      <Text style={styles.nextLabel}>BERIKUTNYA</Text>
      <View style={styles.nextRow}>
        {[1, 2, 3].map((offset) => (
          <View key={offset} style={[styles.nextChip, offset === 1 && styles.nextChipFirst]}>
            <Text style={[styles.nextText, offset === 1 && styles.nextTextFirst]}>{ticketLabel(number + offset)}</Text>
          </View>
        ))}
        <View style={styles.youChip}>
          <Icon name="person" size={12} color={theme.colors.ink} />
          <Text style={styles.youText}>Kamu</Text>
        </View>
      </View>
    </View>
  );
}

function useEntrance(count) {
  const values = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      90,
      values.map((value) => Animated.timing(value, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true })),
    ).start();
  }, [values]);
  return values.map((value) => ({
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
  }));
}

export default function LoginScreen({ onLogin, startupError }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState('');
  const [error, setError] = useState(startupError || '');
  const [loading, setLoading] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const [brand, board, heading, form, demo] = useEntrance(5);

  function shakeForm() {
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 7, -7, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 55, useNativeDriver: true })),
    ).start();
  }

  async function submit() {
    if (!email.trim() || !password) {
      setError('Masukkan email dan password terlebih dahulu.');
      shakeForm();
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
    } catch (loginError) {
      setError(loginError.message);
      setLoading(false);
      shakeForm();
    }
  }

  function pickDemo(account) {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
  }

  const selectedDemo = demoAccounts.find((account) => account.email === email && account.password === password);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.brandRow, brand]}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>CQ</Text></View>
          <Text style={styles.brandName}>Campus Queue</Text>
          <View style={styles.brandBadge}><Text style={styles.brandBadgeText}>Layanan kampus</Text></View>
        </Animated.View>

        <Animated.View style={board}>
          <LiveBoard />
        </Animated.View>

        <Animated.View style={heading}>
          <Text style={styles.title}>Antre digital.</Text>
          <Text style={styles.subtitle}>Ambil nomor dari HP, pantau giliran secara langsung, dan datang ke loket tepat waktu.</Text>
        </Animated.View>

        <Animated.View style={[styles.form, form, { transform: [...form.transform, { translateX: shake }] }]}>
          <View style={[styles.inputWrap, focused === 'email' && styles.inputFocused]}>
            <Icon name="mail-outline" size={19} color={focused === 'email' ? theme.colors.ink : theme.colors.faint} />
            <TextInput
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onBlur={() => setFocused('')}
              onChangeText={setEmail}
              onFocus={() => setFocused('email')}
              placeholder="Email kampus"
              placeholderTextColor={theme.colors.faint}
              returnKeyType="next"
              style={styles.input}
              value={email}
            />
          </View>
          <View style={[styles.inputWrap, focused === 'password' && styles.inputFocused]}>
            <Icon name="lock-closed-outline" size={19} color={focused === 'password' ? theme.colors.ink : theme.colors.faint} />
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              onBlur={() => setFocused('')}
              onChangeText={setPassword}
              onFocus={() => setFocused('password')}
              onSubmitEditing={submit}
              placeholder="Password"
              placeholderTextColor={theme.colors.faint}
              returnKeyType="go"
              secureTextEntry={!showPassword}
              style={styles.input}
              value={password}
            />
            <Pressable onPress={() => setShowPassword((value) => !value)} hitSlop={10} accessibilityLabel="Tampilkan password">
              <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.muted} />
            </Pressable>
          </View>
          <ErrorMessage message={error} />
          <Button label="Masuk" icon="arrow-forward" loading={loading} onPress={submit} style={styles.loginButton} />
        </Animated.View>

        <Animated.View style={demo}>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.demoTitle}>COBA AKUN DEMO</Text>
            <View style={styles.dividerLine} />
          </View>
          <View style={styles.demoRow}>
            {demoAccounts.map((account) => {
              const active = selectedDemo?.email === account.email;
              return (
                <Pressable
                  key={account.email}
                  onPress={() => pickDemo(account)}
                  style={({ pressed }) => [styles.demoChip, active && styles.demoChipActive, pressed && styles.demoChipPressed]}
                >
                  <Icon name={account.icon} size={20} color={active ? '#FFFFFF' : theme.colors.ink} />
                  <Text style={[styles.demoChipText, active && styles.demoChipTextActive]}>{account.role}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, paddingHorizontal: 22 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: theme.colors.ink, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  brandName: { flex: 1, color: theme.colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  brandBadge: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  brandBadgeText: { color: theme.colors.muted, fontSize: 11, fontWeight: '600' },
  board: {
    backgroundColor: theme.colors.ink,
    borderRadius: 26,
    padding: 22,
    overflow: 'hidden',
    marginBottom: 28,
    ...theme.shadow,
    shadowOpacity: 0.18,
    elevation: 6,
  },
  boardGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: theme.colors.accent,
    opacity: 0.14,
    top: -130,
    right: -90,
  },
  boardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  liveWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#3DDC97' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3DDC97' },
  liveText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  boardNumber: { color: '#FFFFFF', fontSize: 64, fontWeight: '700', letterSpacing: -2.5, lineHeight: 70 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  boardCounter: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  boardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 16 },
  nextLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 1.6, marginBottom: 10 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.08)' },
  nextChipFirst: { backgroundColor: 'rgba(255,255,255,0.16)' },
  nextText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  nextTextFirst: { color: '#FFFFFF' },
  youChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  youText: { color: theme.colors.ink, fontSize: 12, fontWeight: '700' },
  title: { color: theme.colors.text, fontSize: 38, fontWeight: '700', letterSpacing: -1.5 },
  subtitle: { color: theme.colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
  form: { marginTop: 26 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    marginBottom: 12,
  },
  inputFocused: { borderColor: theme.colors.ink },
  input: { flex: 1, height: '100%', color: theme.colors.text, fontSize: 15 },
  loginButton: { minHeight: 56, borderRadius: 16, marginTop: 4 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 30, marginBottom: 14 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  demoTitle: { color: theme.colors.faint, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  demoRow: { flexDirection: 'row', gap: 10 },
  demoChip: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  demoChipActive: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  demoChipPressed: { transform: [{ scale: 0.97 }] },
  demoChipText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  demoChipTextActive: { color: '#FFFFFF' },
});
