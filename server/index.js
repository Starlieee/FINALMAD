const path = require('node:path');
const { randomUUID } = require('node:crypto');
const jsonServer = require('json-server');
const { registerStaffRoutes } = require('./staffRoutes');
const { registerAppRoutes, ACTIVE_STATUSES } = require('./appRoutes');

const JAKARTA_TIME_ZONE = 'Asia/Jakarta';

function getJakartaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function createApp(data = path.join(__dirname, '..', 'db.json')) {
  const app = jsonServer.create();
  const router = jsonServer.router(data);
  let writeQueue = Promise.resolve();

  const serializeWrite = (operation) => {
    const result = writeQueue.then(operation, operation);
    writeQueue = result.catch(() => {});
    return result;
  };

  app.use(jsonServer.defaults());
  app.use(jsonServer.bodyParser);
  registerStaffRoutes({ app, router, serializeWrite, getJakartaDate });
  registerAppRoutes({ app, router, serializeWrite, getJakartaDate });

  app.post('/login', (request, response) => {
    const email = String(request.body.email || '').trim().toLowerCase();
    const password = String(request.body.password || '');
    const user = router.db
      .get('users')
      .find((entry) => entry.email.toLowerCase() === email && entry.password === password)
      .value();

    if (!user) {
      return response.status(401).json({ error: 'Email atau password salah.' });
    }

    const { id, name, role, email: userEmail, studentId, assignedCounter } = user;
    return response.json({ id, name, role, email: userEmail, studentId, assignedCounter });
  });

  app.get('/queue-summary', (_request, response) => {
    const date = getJakartaDate();
    const queues = router.db.get('queues').filter({ date }).value();
    const events = router.db.get('events').value();

    return response.json({
      date,
      events: events.map((event) => {
        const eventQueues = queues.filter((queue) => queue.eventId === event.id);
        return {
          ...event,
          queueCount: eventQueues.length,
          waitingCount: eventQueues.filter((queue) => queue.status === 'waiting').length,
          remainingQuota: Math.max(0, event.dailyQuota - eventQueues.length),
        };
      }),
    });
  });

  app.post('/take-queue', async (request, response) => {
    try {
      const ticket = await serializeWrite(() => {
        const userId = String(request.body.userId || '');
        const eventId = String(request.body.eventId || '');
        const user = router.db.get('users').find({ id: userId }).value();
        const event = router.db.get('events').find({ id: eventId }).value();

        if (!user || !['user', 'admin'].includes(user.role)) {
          return { status: 403, body: { error: 'Akun tidak memiliki akses untuk mengambil antrean.' } };
        }
        if (!event || event.status !== 'open') {
          const reason = event && event.status === 'paused' ? 'sedang dijeda' : 'sedang tutup';
          return { status: 400, body: { error: `Layanan tidak tersedia atau ${reason}.` } };
        }

        const date = getJakartaDate();
        const queues = router.db.get('queues');
        const todaysQueues = queues.filter({ eventId, date });
        const active = queues
          .find((queue) => queue.userId === userId && queue.date === date && ACTIVE_STATUSES.includes(queue.status))
          .value();
        if (active) {
          return {
            status: 409,
            body: { error: `Anda masih memiliki antrean aktif (${active.ticket}). Selesaikan atau batalkan dulu.`, code: 'ACTIVE_QUEUE' },
          };
        }
        if (todaysQueues.size().value() >= event.dailyQuota) {
          return { status: 409, body: { error: 'Kuota antrean layanan hari ini sudah habis.' } };
        }

        const counterCollection = router.db.get('counters');
        let counter = counterCollection.find({ eventId, date }).value();
        if (!counter) {
          counter = { id: `${eventId}-${date}`, eventId, date, nextNumber: 1 };
          counterCollection.push(counter).write();
        }

        const number = counter.nextNumber;
        const queue = {
          id: randomUUID(),
          userId,
          eventId,
          date,
          number,
          ticket: `${event.prefix}-${String(number).padStart(3, '0')}`,
          status: 'waiting',
          createdAt: new Date().toISOString(),
        };
        queues.push(queue).write();
        counterCollection.find({ id: counter.id }).assign({ nextNumber: number + 1 }).write();

        return { status: 201, body: queue };
      });

      return response.status(ticket.status).json(ticket.body);
    } catch (error) {
      console.error('Gagal memproses pengambilan antrean:', error);
      return response.status(500).json({ error: 'Terjadi kesalahan saat membuat antrean.' });
    }
  });

  router.render = (request, response) => {
    let data = response.locals.data;
    if (request.path === '/users' || request.path.startsWith('/users/')) {
      const withoutPassword = (user) => {
        if (!user || typeof user !== 'object') return user;
        const { password, ...safeUser } = user;
        return safeUser;
      };
      data = Array.isArray(data) ? data.map(withoutPassword) : withoutPassword(data);
    }
    return response.json(data);
  };

  app.use(router);
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3001);
  createApp().listen(port, '0.0.0.0', () => {
    console.log(`Campus Queue API berjalan di http://localhost:${port}`);
  });
}

module.exports = { createApp, getJakartaDate };
