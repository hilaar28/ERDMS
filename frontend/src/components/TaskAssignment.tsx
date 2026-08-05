import React, { useState, useEffect } from 'react';

interface Task {
  id: number;
  title: string;
  description: string;
  document_id: number;
  document_name: string;
  assigned_to: number;
  assignee_username: string;
  assignee_full_name: string;
  assigned_by: number;
  assigner_username: string;
  assigner_full_name: string;
  status: string;
  priority: string;
  due_date: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: number;
  username: string;
  full_name: string;
}

interface TaskAssignmentProps {
  API_URL: string;
}

const TaskAssignment: React.FC<TaskAssignmentProps> = ({ API_URL }) => {
  const tasksUrl = API_URL.replace('/documents', '/tasks');
  const authUrl = API_URL.replace('/documents', '/auth');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    documentId: '',
    assignedTo: '',
    priority: 'normal',
    dueDate: ''
  });

  const [assignForm, setAssignForm] = useState({
    taskId: '',
    userId: '',
    roleInTask: ''
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${tasksUrl}/tasks`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${authUrl}/users`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_URL}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const fetchMyTasks = async () => {
    try {
      const response = await fetch(`${tasksUrl}/me/tasks`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch my tasks:', error);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchUsers();
    fetchDocuments();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      setMessage({ type: 'error', text: 'Task title is required' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${tasksUrl}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          title: taskForm.title,
          description: taskForm.description,
          documentId: taskForm.documentId ? parseInt(taskForm.documentId) : null,
          assignedTo: taskForm.assignedTo ? parseInt(taskForm.assignedTo) : null,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate || null
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Task created successfully' });
        setTaskForm({ title: '', description: '', documentId: '', assignedTo: '', priority: 'normal', dueDate: '' });
        setShowCreateForm(false);
        fetchTasks();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create task' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.taskId || !assignForm.userId) {
      setMessage({ type: 'error', text: 'Task and user are required' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${tasksUrl}/tasks/${assignForm.taskId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ userId: parseInt(assignForm.userId), roleInTask: assignForm.roleInTask })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'User assigned to task' });
        setAssignForm({ taskId: '', userId: '', roleInTask: '' });
        setShowAssignForm(false);
        fetchTasks();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to assign user' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId: number, status: string) => {
    try {
      await fetch(`${tasksUrl}/tasks/${taskId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status })
      });
      fetchTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await fetch(`${tasksUrl}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const priorityColors: Record<string, string> = {
    low: '#28a745',
    normal: '#007bff',
    high: '#ffc107',
    urgent: '#dc3545'
  };

  const statusOptions = [
    { value: 'pending', label: 'Pending', color: '#6c757d' },
    { value: 'in_progress', label: 'In Progress', color: '#007bff' },
    { value: 'completed', label: 'Completed', color: '#28a745' },
    { value: 'cancelled', label: 'Cancelled', color: '#dc3545' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => { fetchTasks(); setShowCreateForm(false); setShowAssignForm(false); }}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            All Tasks
          </button>
          <button
            onClick={() => { fetchMyTasks(); setShowCreateForm(false); setShowAssignForm(false); }}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            My Tasks
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => { setShowCreateForm(true); setShowAssignForm(false); }}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            + New Task
          </button>
          <button
            onClick={() => { setShowAssignForm(true); setShowCreateForm(false); }}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            + Assign User
          </button>
        </div>
      </div>

      {message.text && (
        <div style={{
          padding: '0.75rem', borderRadius: '4px', marginBottom: '1.5rem',
          backgroundColor: message.type === 'error' ? '#f8d7da' : '#d4edda',
          color: message.type === 'error' ? '#721c24' : '#155724'
        }}>
          {message.text}
        </div>
      )}

      {showCreateForm && (
        <div style={{
          padding: '1.5rem', backgroundColor: '#f9f9f9', borderRadius: '8px', marginBottom: '1.5rem'
        }}>
          <h3 style={{ color: '#333', marginTop: '0' }}>Create New Task</h3>
          <form onSubmit={handleCreateTask}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Title*</label>
              <input
                type="text"
                value={taskForm.title}
                onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
                required
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Description</label>
              <textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({...taskForm, description: e.target.value})}
                placeholder="Task description..."
                rows={3}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>Document</label>
                <select
                  value={taskForm.documentId}
                  onChange={(e) => setTaskForm({...taskForm, documentId: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">-- Select Document --</option>
                  {documents.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>Assign To</label>
                <select
                  value={taskForm.assignedTo}
                  onChange={(e) => setTaskForm({...taskForm, assignedTo: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">-- Select User --</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.full_name || user.username}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>Priority</label>
                <select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>Due Date</label>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({...taskForm, dueDate: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {loading ? 'Creating...' : 'Create Task'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showAssignForm && (
        <div style={{
          padding: '1.5rem', backgroundColor: '#e9f7ff', borderRadius: '8px', marginBottom: '1.5rem'
        }}>
          <h3 style={{ color: '#333', marginTop: '0' }}>Assign User to Task</h3>
          <form onSubmit={handleAssignUser}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>Task</label>
                <select
                  value={assignForm.taskId}
                  onChange={(e) => setAssignForm({...assignForm, taskId: e.target.value})}
                  required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">-- Select Task --</option>
                  {tasks.filter(t => t.status !== 'completed').map(task => (
                    <option key={task.id} value={task.id}>{task.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>User</label>
                <select
                  value={assignForm.userId}
                  onChange={(e) => setAssignForm({...assignForm, userId: e.target.value})}
                  required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">-- Select User --</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.full_name || user.username}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Role in Task</label>
              <input
                type="text"
                value={assignForm.roleInTask}
                onChange={(e) => setAssignForm({...assignForm, roleInTask: e.target.value})}
                placeholder="e.g. Reviewer, Approver"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {loading ? 'Assigning...' : 'Assign'}
              </button>
              <button
                type="button"
                onClick={() => setShowAssignForm(false)}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <h3 style={{ color: '#333' }}>Task List</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ padding: '0.5rem', textAlign: 'left' }}>ID</th>
            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Title</th>
            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Document</th>
            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Assigned To</th>
            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Priority</th>
            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Due Date</th>
            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
            <th style={{ padding: '0.5rem', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>{task.id}</td>
              <td style={{ padding: '0.5rem' }}>{task.title}</td>
              <td style={{ padding: '0.5rem' }}>{task.document_name || 'N/A'}</td>
              <td style={{ padding: '0.5rem' }}>{task.assignee_full_name || task.assignee_username || 'Unassigned'}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{
                  padding: '0.15rem 0.5rem',
                  backgroundColor: `${priorityColors[task.priority] || '#007bff'}20`,
                  color: priorityColors[task.priority] || '#007bff',
                  borderRadius: '10px',
                  fontSize: '0.8rem'
                }}>
                  {task.priority}
                </span>
              </td>
              <td style={{ padding: '0.5rem' }}>{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</td>
              <td style={{ padding: '0.5rem' }}>
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(task.id, e.target.value)}
                  style={{
                    padding: '0.2rem 0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                    fontSize: '0.85rem'
                  }}
                >
                  {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  style={{
                    padding: '0.2rem 0.5rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && <p style={{ color: '#999', textAlign: 'center', marginTop: '2rem' }}>No tasks found</p>}
    </div>
  );
};

export default TaskAssignment;