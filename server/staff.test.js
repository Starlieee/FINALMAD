const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp, getJakartaDate } = require('./index');

async function startServer(context, queues = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'campus-queue-staff-'));
  const database = path.join(directory, 'db.json');
  fs.writeFileSync(database, JSON.stringify({
    users: [
      { id: 'staff-1', role: 'petugas', assignedCounter: 'Loket Akademik' },
      { id: 'staff-2', role: 'petugas', assignedCounter: 'Loket Keuangan' },
      { id: 'user-1', role: 'user' },
    ],
    events: [
      { id: 'academic', counterName: 'Loket Akademik' },
      { id: 'finance', counterName: 'Loket Keuangan' },
    ],
    counters: [],
    queues,
  }));
  const server = createApp(database).listen(0);
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  await new Promise((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

function queue(id, number, status = 'waiting', eventId = 'academic') {
  return {
    id,
    eventId,
    userId: 'user-1',
    date: getJakartaDate(),
    number,
    ticket: `A-${String(number).padStart(3, '0')}`,
    status,
    createdAt: new Date().toISOString(),
  };
}

async function post(baseUrl, path, staffId = 'staff-1') {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staffId }),
  });
}

test('panel mengurutkan antrean, memanggil nomor terkecil, dan membatasi satu antrean aktif', async (context) => {
  const baseUrl = await startServer(context, [queue('q-8', 8), queue('q-2', 2)]);
  const panelResponse = await fetch(`${baseUrl}/staff/panel?staffId=staff-1`);
  const panel = await panelResponse.json();
  assert.equal(panel.counterName, 'Loket Akademik');
  assert.deepEqual(panel.waiting.map(({ number }) => number), [2, 8]);
  assert.equal(panel.waitingCount, 2);
  assert.equal(panel.waiting[0].counterName, null);
  assert.equal(panel.waiting[0].calledAt, null);
  assert.equal(panel.waiting[0].servedAt, null);
  assert.equal(panel.waiting[0].completedAt, null);

  const calledResponse = await post(baseUrl, '/staff/call-next');
  const called = await calledResponse.json();
  assert.equal(calledResponse.status, 200);
  assert.equal(called.id, 'q-2');
  assert.equal(called.status, 'called');
  assert.equal(called.counterName, 'Loket Akademik');
  assert.ok(called.calledAt);
  assert.equal((await post(baseUrl, '/staff/call-next')).status, 409);

  const busyPanel = await (await fetch(`${baseUrl}/staff/panel?staffId=staff-1`)).json();
  assert.equal(busyPanel.activeQueue.id, 'q-2');
  assert.equal(busyPanel.waitingCount, 1);
});

test('semua transisi status valid dapat dilakukan', async (context) => {
  const baseUrl = await startServer(context, [queue('q-1', 1), queue('q-2', 2)]);

  const called = await (await post(baseUrl, '/staff/call-next')).json();
  assert.equal((await post(baseUrl, `/staff/queues/${called.id}/recall`)).status, 200);
  assert.ok((await (await fetch(`${baseUrl}/staff/panel?staffId=staff-1`)).json()).activeQueue.calledAt);

  const startedResponse = await post(baseUrl, `/staff/queues/${called.id}/start`);
  const started = await startedResponse.json();
  assert.equal(started.status, 'serving');
  assert.ok(started.servedAt);
  assert.equal((await post(baseUrl, '/staff/call-next')).status, 409);
  const completed = await (await post(baseUrl, `/staff/queues/${called.id}/complete`)).json();
  assert.equal(completed.status, 'completed');
  assert.ok(completed.completedAt);

  const second = await (await post(baseUrl, '/staff/call-next')).json();
  assert.equal((await post(baseUrl, `/staff/queues/${second.id}/skip`)).status, 200);
  const skippedPanel = await (await fetch(`${baseUrl}/staff/panel?staffId=staff-1`)).json();
  assert.equal(skippedPanel.activeQueue, null);
  assert.equal(skippedPanel.skipped[0].id, second.id);

  const calledAgainResponse = await post(baseUrl, `/staff/queues/${second.id}/call-skipped`);
  const calledAgain = await calledAgainResponse.json();
  assert.equal(calledAgain.status, 'called');
  assert.equal(calledAgain.counterName, 'Loket Akademik');
  assert.ok(calledAgain.calledAt);
});

test('transisi tidak valid, peran selain petugas, dan antrean loket lain ditolak', async (context) => {
  const oldQueue = queue('q-old', 3);
  oldQueue.date = '2000-01-01';
  const baseUrl = await startServer(context, [
    queue('q-waiting', 1),
    queue('q-finance', 2, 'waiting', 'finance'),
    oldQueue,
  ]);

  const forbiddenRole = await post(baseUrl, '/staff/call-next', 'user-1');
  assert.equal(forbiddenRole.status, 403);
  assert.equal((await (await post(baseUrl, '/staff/queues/q-finance/start')).json()).error.includes('berwenang'), true);
  assert.equal((await post(baseUrl, '/staff/queues/q-old/start')).status, 403);

  const called = await (await post(baseUrl, '/staff/call-next')).json();
  const invalidComplete = await post(baseUrl, `/staff/queues/${called.id}/complete`);
  assert.equal(invalidComplete.status, 409);
  assert.match((await invalidComplete.json()).error, /dilayani/);

  assert.equal((await post(baseUrl, `/staff/queues/${called.id}/start`)).status, 200);
  const invalidRecall = await post(baseUrl, `/staff/queues/${called.id}/recall`);
  assert.equal(invalidRecall.status, 409);
  assert.match((await invalidRecall.json()).error, /dipanggil ulang/);
});

test('menolak pemanggilan kembali saat loket sibuk dan memberi 404 jika tidak ada antrean', async (context) => {
  const baseUrl = await startServer(context, [queue('q-1', 1, 'skipped'), queue('q-2', 2)]);
  await post(baseUrl, '/staff/call-next');
  const callSkipped = await post(baseUrl, '/staff/queues/q-1/call-skipped');
  assert.equal(callSkipped.status, 409);

  const noWaitingBaseUrl = await startServer(context, [queue('q-done', 5, 'completed')]);
  const noWaiting = await post(noWaitingBaseUrl, '/staff/call-next');
  assert.equal(noWaiting.status, 404);
  assert.equal((await noWaiting.json()).error, 'Tidak ada antrean yang menunggu.');
});
