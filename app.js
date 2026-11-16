import express from 'express';

/* ========================================
   Application — isolated task data for each server instance
   ======================================== */

export function createApp({
  initialTasks,
  allowedOrigins = (
    process.env.CORS_ORIGINS ||
    'http://localhost:5173,http://localhost:4173,https://danny-task-manager-react.netlify.app'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  const tasks = structuredClone(
    initialTasks ?? [
      { id: crypto.randomUUID(), title: 'Learn Node.js', completed: false },
      { id: crypto.randomUUID(), title: 'Practice Express', completed: false },
    ],
  );

  /* ========================================
     Middleware — browser origins and JSON request bodies
     ======================================== */

  app.use((req, res, next) => {
    const origin = req.get('Origin');
    res.vary('Origin');
    if (origin && !allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    if (origin) res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.status(204).send();
    next();
  });
  app.use(express.json({ limit: '16kb' }));

  /* ========================================
     Routes — health, reading and changing tasks
     ======================================== */

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', storage: 'memory' });
  });

  app.get('/tasks', (req, res) => res.json(tasks));

  app.get('/tasks/:id', (req, res) => {
    const task = tasks.find((task) => task.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  app.post('/tasks', (req, res) => {
    const title = req.body?.title;
    if (typeof title !== 'string') {
      return res.status(400).json({ error: 'Title must be a string' });
    }
    const trimmedTitle = title.trim();
    if (trimmedTitle === '') {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }
    if (trimmedTitle.length > 200) {
      return res
        .status(400)
        .json({ error: 'Title must be 200 characters or fewer' });
    }
    const newTask = {
      id: crypto.randomUUID(),
      title: trimmedTitle,
      completed: false,
    };
    tasks.push(newTask);
    res.status(201).json(newTask);
  });

  app.patch('/tasks/:id', (req, res) => {
    const task = tasks.find((task) => task.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const completed = req.body?.completed;
    if (typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'Completed must be a boolean' });
    }
    task.completed = completed;
    res.json(task);
  });

  app.delete('/tasks/:id', (req, res) => {
    const index = tasks.findIndex((task) => task.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Task not found' });
    tasks.splice(index, 1);
    res.status(204).send();
  });

  /* ========================================
     Errors — keep API error responses in JSON
     ======================================== */

  app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large' });
    }
    console.error('API request failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
