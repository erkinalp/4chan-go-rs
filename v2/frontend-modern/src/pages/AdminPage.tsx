import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useBoards } from '@/api/boards';
import LoadingFallback from '@/components/LoadingFallback';
import api from '@/api/axios';
import type { Board, SystemHealth } from '@/types/api';
import { useQuery } from '@tanstack/react-query';

type Tab = 'boards' | 'users' | 'health';

function useSystemHealth() {
  return useQuery<SystemHealth>({
    queryKey: ['systemHealth'],
    queryFn: async () => {
      const { data } = await api.get<SystemHealth>('/admin/health');
      return data;
    },
    refetchInterval: 30000,
  });
}

interface UserSummary {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

function useUsers() {
  return useQuery<UserSummary[]>({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const { data } = await api.get<UserSummary[]>('/admin/users');
      return data;
    },
  });
}

const AdminPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('boards');
  const { data: boards, isLoading: boardsLoading } = useBoards();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: health, isLoading: healthLoading } = useSystemHealth();

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '6px 16px',
    cursor: 'pointer',
    background: tab === t ? 'var(--bg-post)' : 'transparent',
    border: '1px solid var(--border)',
    borderBottom: tab === t ? 'none' : '1px solid var(--border)',
    borderRadius: '4px 4px 0 0',
    color: 'var(--text-primary)',
    fontWeight: tab === t ? 'bold' : 'normal',
  });

  const thStyle: React.CSSProperties = {
    padding: '6px 8px',
    textAlign: 'left',
    background: 'var(--bg-secondary)',
    borderBottom: '2px solid var(--border)',
    fontSize: '0.85rem',
  };

  const tdStyle: React.CSSProperties = {
    padding: '6px 8px',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.85rem',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h1 style={{ fontSize: '1.2rem', color: 'var(--accent)', marginBottom: '16px' }}>
        Admin Panel
      </h1>

      <div style={{ display: 'flex', gap: '2px', marginBottom: '-1px' }}>
        <button style={tabStyle('boards')} onClick={() => setTab('boards')}>
          Boards
        </button>
        <button style={tabStyle('users')} onClick={() => setTab('users')}>
          Users
        </button>
        <button style={tabStyle('health')} onClick={() => setTab('health')}>
          System Health
        </button>
      </div>

      <div
        style={{
          border: '1px solid var(--border)',
          padding: '16px',
          background: 'var(--bg-post)',
        }}
      >
        {tab === 'boards' && (
          <>
            {boardsLoading ? (
              <LoadingFallback />
            ) : (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <button
                    style={{
                      padding: '4px 12px',
                      cursor: 'pointer',
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                    }}
                  >
                    + Create Board
                  </button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Short Name</th>
                      <th style={thStyle}>Title</th>
                      <th style={thStyle}>Category</th>
                      <th style={thStyle}>NSFW</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boards?.map((board: Board) => (
                      <tr key={board.id}>
                        <td style={tdStyle}>/{board.shortName}/</td>
                        <td style={tdStyle}>{board.title}</td>
                        <td style={tdStyle}>{board.category}</td>
                        <td style={tdStyle}>{board.isNSFW ? 'Yes' : 'No'}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                              }}
                            >
                              Edit
                            </button>
                            <button
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                background: '#e74c3c',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '2px',
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        {tab === 'users' && (
          <>
            {usersLoading ? (
              <LoadingFallback />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Username</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Active</th>
                    <th style={thStyle}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.map((user) => (
                    <tr key={user.id}>
                      <td style={tdStyle}>{user.username}</td>
                      <td style={tdStyle}>{user.role}</td>
                      <td style={tdStyle}>{user.isActive ? 'Yes' : 'No'}</td>
                      <td style={tdStyle}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {tab === 'health' && (
          <>
            {healthLoading ? (
              <LoadingFallback />
            ) : health ? (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <strong>Status: </strong>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '3px',
                      background:
                        health.status === 'healthy'
                          ? '#27ae60'
                          : health.status === 'degraded'
                            ? '#f39c12'
                            : '#e74c3c',
                      color: '#fff',
                      fontSize: '0.85rem',
                    }}
                  >
                    {health.status}
                  </span>
                </div>
                <div style={{ marginBottom: '8px', fontSize: '0.85rem' }}>
                  <strong>Version:</strong> {health.version}
                </div>
                <div style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
                  <strong>Uptime:</strong> {Math.round(health.uptime / 3600)}h
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Service</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(health.services).map(([name, svc]) => (
                      <tr key={name}>
                        <td style={tdStyle}>{name}</td>
                        <td style={tdStyle}>{svc.status}</td>
                        <td style={tdStyle}>{svc.latency}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Could not load health data.</p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

export default AdminPage;
