function registerStaffRoutes({ app, router, serializeWrite, getJakartaDate }) {
  function getStaff(staffId) {
    const staff = router.db.get('users').find({ id: String(staffId || '') }).value();
    if (!staff || !['petugas', 'admin'].includes(staff.role)) {
      return { status: 403, body: { error: 'Akun tidak memiliki akses sebagai petugas.' } };
    }
    return { staff };
  }

  function getAssignedQueues(staff, date) {
    const matchingEventIds = router.db
      .get('events')
      .filter((event) => Boolean(staff.assignedCounter) && event.counterName === staff.assignedCounter)
      .map('id')
      .value();
    return router.db
      .get('queues')
      .filter((queue) => queue.date === date && matchingEventIds.includes(queue.eventId));
  }

  function normalizeQueue(queue) {
    return {
      ...queue,
      counterName: queue.counterName ?? null,
      calledAt: queue.calledAt ?? null,
      servedAt: queue.servedAt ?? null,
      completedAt: queue.completedAt ?? null,
    };
  }

  function hasActiveQueue(staff, date) {
    return getAssignedQueues(staff, date)
      .filter((queue) => queue.status === 'called' || queue.status === 'serving')
      .value().length > 0;
  }

  app.get('/staff/panel', (request, response) => {
    const access = getStaff(request.query.staffId);
    if (!access.staff) return response.status(access.status).json(access.body);

    const { staff } = access;
    const date = getJakartaDate();
    const queues = getAssignedQueues(staff, date).value();
    const active = queues.find((queue) => queue.status === 'called' || queue.status === 'serving');
    const activeQueue = active ? normalizeQueue(active) : null;
    const waiting = queues
      .filter((queue) => queue.status === 'waiting')
      .sort((left, right) => left.number - right.number)
      .map(normalizeQueue);
    const skipped = queues
      .filter((queue) => queue.status === 'skipped')
      .sort((left, right) => left.number - right.number)
      .map(normalizeQueue);

    return response.json({
      counterName: staff.assignedCounter || null,
      activeQueue,
      waiting,
      skipped,
      waitingCount: waiting.length,
    });
  });

  async function processQueue(request, response, operation) {
    try {
      const result = await serializeWrite(() => {
        const access = getStaff(request.body.staffId);
        if (!access.staff) return access;
        return operation(access.staff);
      });
      return response.status(result.status || 200).json(result.body);
    } catch (error) {
      console.error('Gagal memproses antrean petugas:', error);
      return response.status(500).json({ error: 'Terjadi kesalahan saat memproses antrean.' });
    }
  }

  app.post('/staff/call-next', (request, response) =>
    processQueue(request, response, (staff) => {
      const date = getJakartaDate();
      if (hasActiveQueue(staff, date)) {
        return { status: 409, body: { error: 'Loket masih menangani antrean.' } };
      }

      const queue = getAssignedQueues(staff, date)
        .filter({ status: 'waiting' })
        .sort((left, right) => left.number - right.number)
        .value()[0];
      if (!queue) {
        return { status: 404, body: { error: 'Tidak ada antrean yang menunggu.' } };
      }

      const updatedQueue = router.db.get('queues').find({ id: queue.id }).assign({
        status: 'called',
        counterName: staff.assignedCounter,
        calledAt: new Date().toISOString(),
        servedAt: queue.servedAt ?? null,
        completedAt: queue.completedAt ?? null,
      }).write();
      return { body: updatedQueue };
    }));

  const transitions = {
    start: {
      from: 'called',
      to: 'serving',
      timestamp: 'servedAt',
      error: 'Antrean hanya dapat mulai dilayani jika sudah dipanggil.',
    },
    complete: {
      from: 'serving',
      to: 'completed',
      timestamp: 'completedAt',
      error: 'Antrean hanya dapat diselesaikan saat sedang dilayani.',
    },
    recall: {
      from: 'called',
      timestamp: 'calledAt',
      error: 'Antrean hanya dapat dipanggil ulang jika berstatus dipanggil.',
    },
    skip: {
      from: 'called',
      to: 'skipped',
      error: 'Antrean hanya dapat dilewati jika berstatus dipanggil.',
    },
    'call-skipped': {
      from: 'skipped',
      to: 'called',
      timestamp: 'calledAt',
      error: 'Hanya antrean yang dilewati yang dapat dipanggil kembali.',
    },
  };

  Object.entries(transitions).forEach(([action, transition]) => {
    app.post(`/staff/queues/:id/${action}`, (request, response) =>
      processQueue(request, response, (staff) => {
        const queue = router.db.get('queues').find({ id: request.params.id }).value();
        if (!queue) {
          return { status: 404, body: { error: 'Antrean tidak ditemukan.' } };
        }

        const event = router.db.get('events').find({ id: queue.eventId }).value();
        if (
          queue.date !== getJakartaDate() ||
          !event ||
          event.counterName !== staff.assignedCounter
        ) {
          return { status: 403, body: { error: 'Anda tidak berwenang memproses antrean ini.' } };
        }

        if (queue.status !== transition.from) {
          return { status: 409, body: { error: transition.error } };
        }

        if (action === 'call-skipped' && hasActiveQueue(staff, getJakartaDate())) {
          return { status: 409, body: { error: 'Loket masih menangani antrean.' } };
        }

        const updates = {
          counterName: queue.counterName ?? staff.assignedCounter ?? null,
          calledAt: queue.calledAt ?? null,
          servedAt: queue.servedAt ?? null,
          completedAt: queue.completedAt ?? null,
        };
        if (transition.to) updates.status = transition.to;
        if (action === 'call-skipped') updates.counterName = staff.assignedCounter;
        if (transition.timestamp) updates[transition.timestamp] = new Date().toISOString();

        const updatedQueue = router.db.get('queues').find({ id: queue.id }).assign(updates).write();
        return { body: updatedQueue };
      }));
  });
}

module.exports = { registerStaffRoutes };
