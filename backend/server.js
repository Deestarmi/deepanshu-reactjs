const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// In-memory task store (no DB needed for learning)
let tasks = [
  { id: 1, title: 'Learn Helm', done: false },
  { id: 2, title: 'Deploy with ArgoCD', done: false },
  { id: 3, title: 'Master GitOps', done: false },
];
let nextId = 4;

app.get('/health', (req, res) => res.json({ status: 'ok', version: process.env.APP_VERSION || '1.0.0' }));

app.get('/api/tasks', (req, res) => res.json(tasks));

app.post('/api/tasks', (req, res) => {
  const task = { id: nextId++, title: req.body.title, done: false };
  tasks.push(task);
  res.status(201).json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === parseInt(req.params.id));
  if (!task) return res.status(404).json({ error: 'Not found' });
  task.done = !task.done;
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  tasks = tasks.filter(t => t.id !== parseInt(req.params.id));
  res.status(204).send();
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`TaskFlow API running on port ${PORT}`));
