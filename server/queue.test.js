const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./index');

test('take-queue assigns sequential tickets and rejects duplicates and exhausted quota', async (context) => {
  const app = createApp({
    users: [
      { id: 'user-1', name: 'Satu', email: 'satu@example.test', password: 'pass', role: 'user' },
      { id: 'user-2', name: 'Dua', email: 'dua@example.test', password: 'pass', role: 'user' },
      { id: 'user-3', name: 'Tiga', email: 'tiga@example.test', password: 'pass', role: 'user' },
    ],
    events: [{ id: 'event-1', name: 'Akademik', prefix: 'A', dailyQuota: 2, status: 'open' }],
    counters: [],
    queues: [],
  });
  const server = app.listen(0);
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const responses = await Promise.all([
    fetch(`${baseUrl}/take-queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', eventId: 'event-1' }),
    }),
    fetch(`${baseUrl}/take-queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-2', eventId: 'event-1' }),
    }),
  ]);
  assert.deepEqual(responses.map(({ status }) => status), [201, 201]);

  const tickets = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(tickets.map(({ ticket }) => ticket).sort(), ['A-001', 'A-002']);

  const duplicateResponse = await fetch(`${baseUrl}/take-queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: tickets[0].userId, eventId: 'event-1' }),
  });
  assert.equal(duplicateResponse.status, 409);

  const exhaustedResponse = await fetch(`${baseUrl}/take-queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'user-3', eventId: 'event-1' }),
  });
  assert.equal(exhaustedResponse.status, 409);

  const summary = await (await fetch(`${baseUrl}/queue-summary`)).json();
  assert.equal(summary.events[0].remainingQuota, 0);
  assert.equal(summary.events[0].waitingCount, 2);
});

test('login returns a session profile and user listing never exposes passwords', async (context) => {
  const app = createApp({
    users: [{ id: 'user-1', name: 'Satu', email: 'satu@example.test', password: 'secret', role: 'user' }],
    events: [],
    counters: [],
    queues: [],
  });
  const server = app.listen(0);
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const loginResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'satu@example.test', password: 'secret' }),
  });
  const session = await loginResponse.json();
  assert.equal(loginResponse.status, 200);
  assert.equal(session.id, 'user-1');
  assert.equal(Object.hasOwn(session, 'password'), false);

  const users = await (await fetch(`${baseUrl}/users`)).json();
  assert.equal(Object.hasOwn(users[0], 'password'), false);
});
