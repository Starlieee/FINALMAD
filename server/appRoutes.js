const ACTIVE_STATUSES = ['waiting', 'called', 'serving'];
const FINAL_STATUSES = ['completed', 'skipped', 'cancelled'];
const EVENT_STATUSES = ['open', 'paused', 'closed'];

function registerAppRoutes({ app, router, serializeWrite, getJakartaDate }) {
  const db = () => router.db;

  function findUser(id) {
    return db().get('users').find({ id: String(id || '') }).value();
  }

  function requireAdmin(id) {
    const user = findUser(id);
    return user && user.role === 'admin' ? user : null;
  }

  function enrichActive(queue, date) {
    const event = db().get('events').find({ id: queue.eventId }).value() || {};
    const eventQueues = db().get('queues').filter({ eventId: queue.eventId, date }).value();
    const aheadCount = eventQueues.filter(
      (entry) => entry.status === 'waiting' && entry.number < queue.number,
    ).length;
    const nowCalling = eventQueues
      .filter((entry) => entry.status === 'called' || entry.status === 'serving')
      .sort((left, right) => String(right.calledAt).localeCompare(String(left.calledAt)))[0];
    return {
      ...queue,
      eventName: event.name || '-',
      counterName: queue.counterName || event.counterName || null,
      aheadCount,
      nowCalling: nowCalling ? nowCalling.ticket : null,
      estimatedMinutes: aheadCount * 4,
    };
  }

  async function run(response, operation) {
    try {
      const result = await serializeWrite(operation);
      return response.status(result.status || 200).json(result.body);
    } catch (error) {
      console.error('Gagal memproses permintaan:', error);
      return response.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
  }

  // Antrean milik user: antrean aktif hari ini beserta posisi, dan riwayat.
  app.get('/my-queues', (request, response) => {
    const userId = String(request.query.userId || '');
    if (!findUser(userId)) return response.status(404).json({ error: 'Akun tidak ditemukan.' });
    const date = getJakartaDate();
    const mine = db().get('queues').filter({ userId }).value();
    const active = mine.find((queue) => queue.date === date && ACTIVE_STATUSES.includes(queue.status));
    const events = db().get('events').value();
    const history = mine
      .filter((queue) => FINAL_STATUSES.includes(queue.status) || (queue.date !== date && ACTIVE_STATUSES.includes(queue.status)))
      .map((queue) => ({ ...queue, eventName: events.find((event) => event.id === queue.eventId)?.name || '-' }))
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
    return response.json({ date, active: active ? enrichActive(active, date) : null, history });
  });

  app.post('/queues/:id/cancel', (request, response) =>
    run(response, () => {
      const queue = db().get('queues').find({ id: request.params.id }).value();
      if (!queue) return { status: 404, body: { error: 'Antrean tidak ditemukan.' } };
      if (queue.userId !== String(request.body.userId || '')) {
        return { status: 403, body: { error: 'Anda hanya dapat membatalkan antrean milik sendiri.' } };
      }
      if (queue.status !== 'waiting') {
        return { status: 409, body: { error: 'Antrean hanya dapat dibatalkan selama masih menunggu.' } };
      }
      const updated = db().get('queues').find({ id: queue.id })
        .assign({ status: 'cancelled', cancelledAt: new Date().toISOString() }).write();
      return { body: updated };
    }));

  // ---------- Admin ----------
  function validateEvent(input, { partial }) {
    const out = {};
    if (!partial || input.name !== undefined) {
      const name = String(input.name || '').trim();
      if (!name) return { error: 'Nama layanan wajib diisi.' };
      out.name = name;
    }
    if (!partial || input.prefix !== undefined) {
      const prefix = String(input.prefix || '').trim().toUpperCase();
      if (!/^[A-Z]$/.test(prefix)) return { error: 'Prefix harus satu huruf (A-Z).' };
      out.prefix = prefix;
    }
    if (!partial || input.dailyQuota !== undefined) {
      const quota = Number(input.dailyQuota);
      if (!Number.isInteger(quota) || quota < 1 || quota > 999) return { error: 'Kuota harus angka 1 sampai 999.' };
      out.dailyQuota = quota;
    }
    if (input.status !== undefined) {
      if (!EVENT_STATUSES.includes(input.status)) return { error: 'Status layanan tidak valid.' };
      out.status = input.status;
    }
    ['description', 'counterName', 'openHours'].forEach((key) => {
      if (input[key] !== undefined) out[key] = String(input[key]).trim();
    });
    return { value: out };
  }

  app.post('/admin/events', (request, response) =>
    run(response, () => {
      if (!requireAdmin(request.body.adminId)) return { status: 403, body: { error: 'Hanya admin yang dapat mengelola layanan.' } };
      const { error, value } = validateEvent(request.body, { partial: false });
      if (error) return { status: 400, body: { error } };
      if (db().get('events').find({ prefix: value.prefix }).value()) {
        return { status: 409, body: { error: `Prefix ${value.prefix} sudah dipakai layanan lain.` } };
      }
      const base = value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'layanan';
      let id = base;
      for (let i = 2; db().get('events').find({ id }).value(); i += 1) id = `${base}-${i}`;
      const event = {
        id,
        description: '',
        counterName: `Loket ${value.name}`,
        openHours: '08.00 - 15.00',
        status: 'open',
        ...value,
      };
      db().get('events').push(event).write();
      return { status: 201, body: event };
    }));

  app.patch('/admin/events/:id', (request, response) =>
    run(response, () => {
      if (!requireAdmin(request.body.adminId)) return { status: 403, body: { error: 'Hanya admin yang dapat mengelola layanan.' } };
      const event = db().get('events').find({ id: request.params.id }).value();
      if (!event) return { status: 404, body: { error: 'Layanan tidak ditemukan.' } };
      const { error, value } = validateEvent(request.body, { partial: true });
      if (error) return { status: 400, body: { error } };
      const date = getJakartaDate();
      const todays = db().get('queues').filter({ eventId: event.id, date });
      if (value.prefix && value.prefix !== event.prefix) {
        if (todays.size().value() > 0) {
          return { status: 409, body: { error: 'Prefix tidak dapat diubah karena sudah ada antrean hari ini.' } };
        }
        if (db().get('events').find({ prefix: value.prefix }).value()) {
          return { status: 409, body: { error: `Prefix ${value.prefix} sudah dipakai layanan lain.` } };
        }
      }
      let cancelledCount = 0;
      if (value.status === 'closed' && event.status !== 'closed') {
        const waiting = todays.filter({ status: 'waiting' }).value();
        cancelledCount = waiting.length;
        const now = new Date().toISOString();
        waiting.forEach((queue) => {
          db().get('queues').find({ id: queue.id }).assign({ status: 'cancelled', cancelledAt: now }).write();
        });
      }
      const updated = db().get('events').find({ id: event.id }).assign(value).write();
      return { body: { ...updated, cancelledCount } };
    }));

  app.get('/admin/stats', (request, response) => {
    if (!requireAdmin(request.query.adminId)) return response.status(403).json({ error: 'Hanya admin yang dapat melihat statistik.' });
    const date = getJakartaDate();
    const queues = db().get('queues').filter({ date }).value();
    const events = db().get('events').value().map((event) => {
      const list = queues.filter((queue) => queue.eventId === event.id);
      const count = (status) => list.filter((queue) => queue.status === status).length;
      const durations = list
        .filter((queue) => queue.status === 'completed' && queue.servedAt && queue.completedAt)
        .map((queue) => new Date(queue.completedAt) - new Date(queue.servedAt))
        .filter((ms) => ms >= 0);
      const avgServiceSeconds = durations.length
        ? Math.round(durations.reduce((sum, ms) => sum + ms, 0) / durations.length / 1000)
        : null;
      return {
        id: event.id,
        name: event.name,
        prefix: event.prefix,
        status: event.status,
        dailyQuota: event.dailyQuota,
        total: list.length,
        waiting: count('waiting'),
        active: count('called') + count('serving'),
        completed: count('completed'),
        skipped: count('skipped'),
        cancelled: count('cancelled'),
        avgServiceSeconds,
      };
    });
    const sum = (key) => events.reduce((total, event) => total + event[key], 0);
    return response.json({
      date,
      totals: {
        total: sum('total'),
        waiting: sum('waiting'),
        completed: sum('completed'),
        skipped: sum('skipped'),
        cancelled: sum('cancelled'),
      },
      events,
    });
  });

  app.get('/admin/staff', (request, response) => {
    if (!requireAdmin(request.query.adminId)) return response.status(403).json({ error: 'Akses ditolak.' });
    const staff = db().get('users').filter({ role: 'petugas' }).value()
      .map(({ password, ...rest }) => rest);
    return response.json(staff);
  });

  app.post('/admin/staff', (request, response) =>
    run(response, () => {
      if (!requireAdmin(request.body.adminId)) return { status: 403, body: { error: 'Hanya admin yang dapat menambah petugas.' } };
      const name = String(request.body.name || '').trim();
      const email = String(request.body.email || '').trim().toLowerCase();
      const password = String(request.body.password || '');
      const assignedCounter = String(request.body.assignedCounter || '').trim();
      if (!name || !email || !password) return { status: 400, body: { error: 'Nama, email, dan kata sandi wajib diisi.' } };
      if (!/^\S+@\S+\.\S+$/.test(email)) return { status: 400, body: { error: 'Format email tidak valid.' } };
      if (password.length < 6) return { status: 400, body: { error: 'Kata sandi minimal 6 karakter.' } };
      if (db().get('users').find((user) => user.email.toLowerCase() === email).value()) {
        return { status: 409, body: { error: 'Email sudah terdaftar.' } };
      }
      const user = { id: `s-${Date.now()}`, name, email, password, role: 'petugas', assignedCounter: assignedCounter || null };
      db().get('users').push(user).write();
      const { password: _hidden, ...safe } = user;
      return { status: 201, body: safe };
    }));

  app.patch('/admin/staff/:id', (request, response) =>
    run(response, () => {
      if (!requireAdmin(request.body.adminId)) return { status: 403, body: { error: 'Akses ditolak.' } };
      const staff = db().get('users').find({ id: request.params.id, role: 'petugas' }).value();
      if (!staff) return { status: 404, body: { error: 'Petugas tidak ditemukan.' } };
      const updated = db().get('users').find({ id: staff.id })
        .assign({ assignedCounter: String(request.body.assignedCounter || '').trim() || null }).write();
      const { password, ...safe } = updated;
      return { body: safe };
    }));
}

module.exports = { registerAppRoutes, ACTIVE_STATUSES };
