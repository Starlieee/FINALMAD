import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import theme from './theme';

export function Screen({ children, scroll = false, style }) {
  const Container = scroll ? ScrollView : View;
  return (
    <Container
      style={[styles.screen, style]}
      contentContainerStyle={scroll ? styles.scrollContent : undefined}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </Container>
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
      {right}
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ label, onPress, loading = false, disabled = false, secondary = false, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (disabled || loading) && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? theme.colors.primary : '#FFFFFF'} />
      ) : (
        <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Badge({ label, tone = 'success' }) {
  const palette =
    tone === 'warning'
      ? [theme.colors.warningSoft, theme.colors.warning]
      : tone === 'danger'
        ? [theme.colors.dangerSoft, theme.colors.danger]
        : [theme.colors.successSoft, theme.colors.success];
  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      <Text style={[styles.badgeText, { color: palette[1] }]}>{label}</Text>
    </View>
  );
}

export function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button">
          <Text style={styles.retryText}>Coba lagi</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 16,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  pageTitle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  titleCopy: { flex: 1 },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  title: { color: theme.colors.text, fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: theme.colors.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  button: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.control,
    paddingHorizontal: 18,
  },
  secondaryButton: { backgroundColor: theme.colors.primarySoft },
  disabledButton: { opacity: 0.55 },
  pressedButton: { opacity: 0.82 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButtonText: { color: theme.colors.primary },
  badge: { borderRadius: theme.radius.pill, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  errorBox: {
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: theme.radius.control,
    marginBottom: 14,
    padding: 14,
  },
  errorText: { color: theme.colors.danger, fontSize: 13, lineHeight: 19 },
  retryText: { color: theme.colors.danger, fontSize: 13, fontWeight: '800', marginTop: 8 },
});
