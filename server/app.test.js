const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, getJakartaDate } = require('./index');

async function start(context, data) {
  const server = createApp(data).listen(0);
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  return call;
}

function fixture() {
  return {
    users: [
      { id: 'u1', name: 'User', email: 'u@x.test', password: 'p', role: 'user' },
      { id: 'u2', name: 'User Dua', email: 'u2@x.test', password: 'p', role: 'user' },
      { id: 'a1', name: 'Admin', email: 'a@x.test', password: 'p', role: 'admin' },
      { id: 's1', name: 'Staff', email: 's@x.test', password: 'p', role: 'petugas', assignedCounter: 'Loket A' },
    ],
    events: [
      { id: 'e1', name: 'Akademik', prefix: 'A', dailyQuota: 10, status: 'open', counterName: 'Loket A' },
      { id: 'e2', name: 'Keuangan', prefix: 'K', dailyQuota: 10, status: 'open', counterName: 'Loket K' },
    ],
    counters: [],
    queues: [],
  };
}

test('satu antrean aktif lintas layanan, posisi, batal, dan riwayat', async (context) => {
  const call = await start(context, fixture());
  const first = await call('POST', '/take-queue', { userId: 'u2', eventId: 'e1' });
  const mine = await call('POST', '/take-queue', { userId: 'u1', eventId: 'e1' });
  assert.equal(mine.status, 201);
  assert.equal(mine.body.ticket, 'A-002');

  const other = await call('POST', '/take-queue', { userId: 'u1', eventId: 'e2' });
  assert.equal(other.status, 409);
  assert.equal(other.body.code, 'ACTIVE_QUEUE');

  let my = await call('GET', '/my-queues?userId=u1');
  assert.equal(my.body.active.ticket, 'A-002');
  assert.equal(my.body.active.aheadCount, 1);

  await call('POST', '/staff/call-next', { staffId: 's1' });
  my = await call('GET', '/my-queues?userId=u1');
  assert.equal(my.body.active.aheadCount, 0);
  assert.equal(my.body.active.nowCalling, 'A-001');

  const forbidden = await call('POST', `/queues/${mine.body.id}/cancel`, { userId: 'u2' });
  assert.equal(forbidden.status, 403);
  const cancelled = await call('POST', `/queues/${mine.body.id}/cancel`, { userId: 'u1' });
  assert.equal(cancelled.body.status, 'cancelled');
  const again = await call('POST', `/queues/${first.body.id}/cancel`, { userId: 'u2' });
  assert.equal(again.status, 409);

  my = await call('GET', '/my-queues?userId=u1');
  assert.equal(my.body.active, null);
  assert.equal(my.body.history.length, 1);

  const retake = await call('POST', '/take-queue', { userId: 'u1', eventId: 'e2' });
  assert.equal(retake.status, 201);
});

test('admin bisa ambil antrean, kelola layanan, petugas, dan melihat statistik', async (context) => {
  const call = await start(context, fixture());
  assert.equal((await call('POST', '/take-queue', { userId: 'a1', eventId: 'e1' })).status, 201);
  await call('POST', '/take-queue', { userId: 'u1', eventId: 'e2' });

  assert.equal((await call('POST', '/admin/events', { adminId: 'u1', name: 'X', prefix: 'X', dailyQuota: 5 })).status, 403);
  assert.equal((await call('POST', '/admin/events', { adminId: 'a1', name: 'X', prefix: 'A', dailyQuota: 5 })).status, 409);
  const created = await call('POST', '/admin/events', { adminId: 'a1', name: 'Perpustakaan', prefix: 'p', dailyQuota: 5 });
  assert.equal(created.status, 201);
  assert.equal(created.body.prefix, 'P');

  assert.equal((await call('PATCH', '/admin/events/e1', { adminId: 'a1', prefix: 'Z' })).status, 409);
  const paused = await call('PATCH', '/admin/events/e1', { adminId: 'a1', status: 'paused' });
  assert.equal(paused.body.status, 'paused');
  const blocked = await call('POST', '/take-queue', { userId: 'u2', eventId: 'e1' });
  assert.equal(blocked.status, 400);

  const closed = await call('PATCH', '/admin/events/e2', { adminId: 'a1', status: 'closed' });
  assert.equal(closed.body.cancelledCount, 1);

  const staff = await call('POST', '/admin/staff', { adminId: 'a1', name: 'Baru', email: 'baru@x.test', password: 'rahasia', assignedCounter: 'Loket K' });
  assert.equal(staff.status, 201);
  assert.equal(staff.body.password, undefined);
  assert.equal((await call('GET', '/admin/staff?adminId=a1')).body.length, 2);

  const panel = await call('GET', '/staff/panel?staffId=a1&counterName=Loket%20A');
  assert.equal(panel.body.counterName, 'Loket A');
  assert.equal(panel.body.waitingCount, 1);

  const stats = await call('GET', '/admin/stats?adminId=a1');
  assert.equal(stats.body.date, getJakartaDate());
  assert.equal(stats.body.totals.total, 2);
  assert.equal(stats.body.totals.cancelled, 1);
});
