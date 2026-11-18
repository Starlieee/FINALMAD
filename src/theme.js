const theme = {
  colors: {
    ink: '#101114',
    primary: '#101114',
    accent: '#2B4EE6',
    accentSoft: '#ECEFFD',
    primarySoft: '#ECEFFD',
    background: '#F5F4F0',
    surface: '#FFFFFF',
    surfaceAlt: '#FAF9F6',
    text: '#101114',
    muted: '#6E7179',
    faint: '#A4A6AC',
    border: '#E6E4DE',
    success: '#11775A',
    successSoft: '#E4F3EC',
    warning: '#9A5B0C',
    warningSoft: '#FBF0DC',
    danger: '#B42E3B',
    dangerSoft: '#FBE9EA',
  },
  radius: {
    card: 22,
    control: 14,
    pill: 999,
  },
  spacing: {
    screen: 20,
  },
  shadow: {
    shadowColor: '#1A1A14',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
};

export const statusMeta = {
  waiting: { label: 'Menunggu', tone: 'neutral' },
  called: { label: 'Dipanggil', tone: 'warning' },
  serving: { label: 'Dilayani', tone: 'accent' },
  completed: { label: 'Selesai', tone: 'success' },
  skipped: { label: 'Dilewati', tone: 'danger' },
  cancelled: { label: 'Dibatalkan', tone: 'neutral' },
};

export const eventStatusMeta = {
  open: { label: 'Buka', tone: 'success' },
  paused: { label: 'Jeda', tone: 'warning' },
  closed: { label: 'Tutup', tone: 'neutral' },
};

export default theme;
