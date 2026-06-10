import { useState, useEffect } from 'react';

const API = window.REACT_APP_API_URL || 'http://localhost:3001';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState('');

  const fetchTasks = () =>
    fetch(`${API}/api/tasks`).then(r => r.json()).then(setTasks);

  useEffect(() => { fetchTasks(); }, []);

  const addTask = async () => {
    if (!input.trim()) return;
    await fetch(`${API}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: input }),
    });
    setInput('');
    fetchTasks();
  };

  const toggleTask = async (id) => {
    await fetch(`${API}/api/tasks/${id}`, { method: 'PATCH' });
    fetchTasks();
  };

  const deleteTask = async (id) => {
    await fetch(`${API}/api/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
  };

  return (
    <div style={{ maxWidth: 600, margin: '60px auto', fontFamily: 'sans-serif', padding: '0 20px' }}>
      <h1 style={{ color: '#2563eb' }}>📋 TaskFlow</h1>
      <p style={{ color: '#64748b' }}>GitOps-powered task manager on AKS</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Add a new task..."
          style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 16 }}
        />
        <button onClick={addTask}
          style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>
          Add
        </button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {tasks.map(t => (
          <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            background: '#f8fafc', borderRadius: 8, marginBottom: 8, border: '1px solid #e2e8f0' }}>
            <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
            <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? '#94a3b8' : '#1e293b', fontSize: 16 }}>
              {t.title}
            </span>
            <button onClick={() => deleteTask(t.id)}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      {tasks.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8' }}>No tasks yet — add one above!</p>}
    </div>
  );
}
