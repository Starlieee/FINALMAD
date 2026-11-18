import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import theme from './theme';

export function Icon({ name, size = 20, color = theme.colors.text, style }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

// Isi layar muncul dengan fade dan geser halus saat pertama kali dibuka.
function FadeIn({ children }) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(value, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [value]);
  const style = {
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function Screen({ children, scroll = false, style, refreshControl }) {
  const insets = useSafeAreaInsets();
  const padTop = { paddingTop: insets.top + 14 };
  if (!scroll) {
    return <View style={[styles.screen, padTop, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={[styles.screenScroll, style]}
      contentContainerStyle={[styles.scrollContent, padTop]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      <FadeIn>{children}</FadeIn>
    </ScrollView>
  );
}

export function PageTitle({ eyebrow, title, subtitle, right }) {
  return (
    <View style={styles.pageTitle}>
      <View style={styles.titleCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.titleRight}>{right}</View> : null}
    </View>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style, dark = false }) {
  return <View style={[styles.card, dark && styles.cardDark, style]}>{children}</View>;
}

export function Button({ label, onPress, loading = false, disabled = false, secondary = false, danger = false, icon, style }) {
  const textColor = secondary ? theme.colors.text : danger ? theme.colors.danger : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        danger && styles.dangerButton,
        (disabled || loading) && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Icon name={icon} size={18} color={textColor} /> : null}
          <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const tones = {
  success: [theme.colors.successSoft, theme.colors.success],
  warning: [theme.colors.warningSoft, theme.colors.warning],
  danger: [theme.colors.dangerSoft, theme.colors.danger],
  accent: [theme.colors.accentSoft, theme.colors.accent],
  neutral: ['#EEEDE8', theme.colors.muted],
  dark: ['rgba(255,255,255,0.12)', '#FFFFFF'],
};

export function Badge({ label, tone = 'success', dot = true }) {
  const [background, color] = tones[tone] || tones.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      {dot ? <View style={[styles.badgeDot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Icon name="alert-circle" size={18} color={theme.colors.danger} />
      <View style={styles.errorCopy}>
        <Text style={styles.errorText}>{message}</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.retryText}>Coba lagi</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Notice({ icon = 'information-circle', tone = 'accent', title, message, action }) {
  const [background, color] = tones[tone] || tones.accent;
  return (
    <View style={[styles.notice, { backgroundColor: background }]}>
      <Icon name={icon} size={20} color={color} />
      <View style={styles.errorCopy}>
        {title ? <Text style={[styles.noticeTitle, { color }]}>{title}</Text> : null}
        {message ? <Text style={[styles.noticeText, { color }]}>{message}</Text> : null}
        {action}
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, message, action }) {
  return (
    <Card style={styles.empty}>
      <View style={styles.emptyIcon}><Icon name={icon} size={22} color={theme.colors.muted} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyText}>{message}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </Card>
  );
}

export function Field({ label, style, ...props }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={theme.colors.faint} style={styles.input} {...props} />
    </View>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stat({ label, value, icon, style }) {
  return (
    <Card style={[styles.stat, style]}>
      {icon ? <Icon name={icon} size={17} color={theme.colors.muted} /> : null}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

export function Row({ label, value, last }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export function Loader() {
  return <ActivityIndicator color={theme.colors.text} style={styles.loader} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.screen },
  screenScroll: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingHorizontal: theme.spacing.screen, paddingBottom: 40 },
  pageTitle: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 12 },
  titleCopy: { flex: 1 },
  titleRight: { paddingTop: 2 },
  eyebrow: { color: theme.colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, marginBottom: 8 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.9 },
  subtitle: { color: theme.colors.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 12 },
  sectionTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 12,
    ...theme.shadow,
  },
  cardDark: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radius.control,
    paddingHorizontal: 18,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secondaryButton: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  dangerButton: { backgroundColor: theme.colors.dangerSoft },
  disabledButton: { opacity: 0.4 },
  pressedButton: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  buttonText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: theme.radius.pill, paddingVertical: 5, paddingHorizontal: 10, alignSelf: 'flex-start' },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  errorBox: { flexDirection: 'row', gap: 10, backgroundColor: theme.colors.dangerSoft, borderRadius: theme.radius.control, marginBottom: 14, padding: 14 },
  errorCopy: { flex: 1 },
  errorText: { color: theme.colors.danger, fontSize: 13, lineHeight: 19 },
  retryText: { color: theme.colors.danger, fontSize: 13, fontWeight: '700', marginTop: 6 },
  notice: { flexDirection: 'row', gap: 10, borderRadius: theme.radius.control, marginBottom: 14, padding: 14 },
  noticeTitle: { fontSize: 14, fontWeight: '700' },
  noticeText: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 30 },
  emptyIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  emptyText: { color: theme.colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: 'center', maxWidth: 270 },
  emptyAction: { alignSelf: 'stretch', marginTop: 18 },
  field: { marginBottom: 14 },
  fieldLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 7 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.control,
    minHeight: 50,
    color: theme.colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surfaceAlt,
  },
  segmented: { flexDirection: 'row', backgroundColor: '#ECEBE6', borderRadius: 13, padding: 3, marginBottom: 16 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  segmentActive: { backgroundColor: theme.colors.surface, ...theme.shadow },
  segmentText: { color: theme.colors.muted, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: theme.colors.text },
  stat: { flex: 1, marginBottom: 0, paddingVertical: 16 },
  statValue: { color: theme.colors.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.8, marginTop: 10 },
  statLabel: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, gap: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowLabel: { color: theme.colors.muted, fontSize: 13 },
  rowValue: { color: theme.colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  loader: { marginVertical: 28 },
});
