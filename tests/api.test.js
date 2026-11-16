import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { ServerResponse } from 'node:http';
import { createApp } from '../app.js';

/* ========================================
   In-process requests — real Express middleware, no TCP socket
   ======================================== */

function request(
  app,
  { method = 'GET', path = '/tasks', data, raw, origin } = {},
) {
  return new Promise((resolve, reject) => {
    const body = raw ?? (data === undefined ? '' : JSON.stringify(data));
    const req = Readable.from(body ? [Buffer.from(body)] : []);
    req.method = method;
    req.url = path;
    req.httpVersionMajor = 1;
    req.httpVersionMinor = 1;
    req.headers = {};
    req.socket = { encrypted: false };
    if (body) {
      req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = String(Buffer.byteLength(body));
    }
    if (origin) req.headers.origin = origin;
    const res = new ServerResponse(req);
    const timer = setTimeout(
      () => reject(new Error('Request did not complete')),
      2000,
    );
    res.end = (chunk) => {
      clearTimeout(timer);
      const text = chunk?.toString() || '';
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        text,
        body: text ? JSON.parse(text) : null,
      });
      return res;
    };
    app.handle(req, res, (error) => {
      clearTimeout(timer);
      reject(error || new Error('Request was not handled'));
    });
  });
}

const initialTasks = [
  { id: 'first', title: 'Learn Node.js', completed: false },
  { id: 'second', title: 'Practice Express', completed: false },
];
const freshApp = () => createApp({ initialTasks });

test('health identifies temporary storage and disables caching', async () => {
  const result = await request(freshApp(), { path: '/health' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: 'ok', storage: 'memory' });
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers['x-powered-by'], undefined);
});

test('lists tasks and retrieves an individual task', async () => {
  const app = freshApp();
  assert.deepEqual((await request(app)).body, initialTasks);
  assert.deepEqual(
    (await request(app, { path: '/tasks/second' })).body,
    initialTasks[1],
  );
});

test('creates a trimmed title with a string ID and status 201', async () => {
  const app = freshApp();
  const result = await request(app, {
    method: 'POST',
    data: { title: '  New task  ', completed: true, id: 'client-id' },
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.title, 'New task');
  assert.equal(result.body.completed, false);
  assert.match(
    result.body.id,
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i,
  );
  assert.equal((await request(app)).body.length, 3);
  assert.deepEqual(
    (await request(app, { path: `/tasks/${result.body.id}` })).body,
    result.body,
  );
});

for (const [name, data] of [
  ['missing body', undefined],
  ['missing title', {}],
  ['number title', { title: 3 }],
  ['null title', { title: null }],
  ['empty title', { title: '' }],
  ['whitespace title', { title: '   ' }],
  ['long title', { title: 'a'.repeat(201) }],
]) {
  test(`rejects ${name} without adding a task`, async () => {
    const app = freshApp();
    const result = await request(app, { method: 'POST', data });
    assert.equal(result.status, 400);
    assert.equal(typeof result.body.error, 'string');
    assert.equal((await request(app)).body.length, 2);
  });
}

test('patches completion in both directions without changing other fields', async () => {
  const app = freshApp();
  for (const completed of [true, false]) {
    const result = await request(app, {
      method: 'PATCH',
      path: '/tasks/first',
      data: { completed, title: 'Ignore this' },
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ...initialTasks[0], completed });
    assert.equal(
      (await request(app, { path: '/tasks/first' })).body.completed,
      completed,
    );
  }
});

for (const data of [
  undefined,
  {},
  { completed: 'true' },
  { completed: 1 },
  { completed: null },
]) {
  test(`rejects an invalid completion value: ${JSON.stringify(data)}`, async () => {
    const app = freshApp();
    const result = await request(app, {
      method: 'PATCH',
      path: '/tasks/first',
      data,
    });
    assert.equal(result.status, 400);
    assert.equal(
      (await request(app, { path: '/tasks/first' })).body.completed,
      false,
    );
  });
}

test('deletes only the selected task and sends an empty 204 response', async () => {
  const app = freshApp();
  const result = await request(app, { method: 'DELETE', path: '/tasks/first' });
  assert.equal(result.status, 204);
  assert.equal(result.text, '');
  assert.deepEqual((await request(app)).body, [initialTasks[1]]);
});

for (const method of ['GET', 'PATCH', 'DELETE']) {
  test(`returns JSON 404 for an unknown task on ${method}`, async () => {
    const app = freshApp();
    const result = await request(app, {
      method,
      path: '/tasks/missing',
      data: method === 'PATCH' ? { completed: true } : undefined,
    });
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, { error: 'Task not found' });
    assert.equal((await request(app)).body.length, 2);
  });
}

test('returns JSON for unknown routes and malformed JSON', async () => {
  const app = freshApp();
  assert.equal((await request(app, { path: '/missing' })).status, 404);
  const bad = await request(app, { method: 'POST', raw: '{broken' });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.body, { error: 'Invalid JSON body' });
});

test('rejects oversized JSON with status 413', async () => {
  const result = await request(freshApp(), {
    method: 'POST',
    data: { title: 'a'.repeat(20000) },
  });
  assert.equal(result.status, 413);
});

test('supports an allowed browser origin and its preflight request', async () => {
  const app = freshApp();
  const origin = 'https://danny-task-manager-react.netlify.app';
  const result = await request(app, { method: 'OPTIONS', origin });
  assert.equal(result.status, 204);
  assert.equal(result.headers['access-control-allow-origin'], origin);
  assert.match(result.headers['access-control-allow-methods'], /PATCH/);
  assert.match(result.headers.vary, /Origin/);
});

test('rejects a disallowed browser origin but accepts requests without Origin', async () => {
  const app = freshApp();
  assert.equal(
    (await request(app, { origin: 'https://unrelated.example' })).status,
    403,
  );
  assert.equal((await request(app)).status, 200);
});

test('keeps separate app instances isolated, modeling a server restart', async () => {
  const app = freshApp();
  await request(app, { method: 'POST', data: { title: 'Temporary' } });
  assert.equal((await request(app)).body.length, 3);
  assert.deepEqual((await request(freshApp())).body, initialTasks);
});
