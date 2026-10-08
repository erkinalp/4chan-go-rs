import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useReports, useResolveReport, useBans, useModLog } from '@/api/moderation';
import LoadingFallback from '@/components/LoadingFallback';

type Tab = 'reports' | 'bans' | 'log';

const ModPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('reports');
  const { data: reportsData, isLoading: reportsLoading } = useReports();
  const { data: bansData, isLoading: bansLoading } = useBans();
  const { data: logData, isLoading: logLoading } = useModLog();
  const resolveReport = useResolveReport();

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
        Moderation Dashboard
      </h1>

      <div style={{ display: 'flex', gap: '2px', marginBottom: '-1px' }}>
        <button style={tabStyle('reports')} onClick={() => setTab('reports')}>
          Reports
        </button>
        <button style={tabStyle('bans')} onClick={() => setTab('bans')}>
          Bans
        </button>
        <button style={tabStyle('log')} onClick={() => setTab('log')}>
          Mod Log
        </button>
      </div>

      <div
        style={{
          border: '1px solid var(--border)',
          padding: '16px',
          background: 'var(--bg-post)',
        }}
      >
        {tab === 'reports' && (
          <>
            {reportsLoading ? (
              <LoadingFallback />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Board</th>
                    <th style={thStyle}>Reason</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsData?.data.map((report) => (
                    <tr key={report.id}>
                      <td style={tdStyle}>{report.id}</td>
                      <td style={tdStyle}>/{report.boardId}/</td>
                      <td style={tdStyle}>{report.reason}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '0.75rem',
                            background:
                              report.status === 'pending'
                                ? '#f39c12'
                                : report.status === 'resolved'
                                  ? '#27ae60'
                                  : '#95a5a6',
                            color: '#fff',
                          }}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {new Date(report.createdAt).toLocaleDateString()}
                      </td>
                      <td style={tdStyle}>
                        {report.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={() =>
                                resolveReport.mutate({ reportId: report.id, action: 'resolve' })
                              }
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                background: '#27ae60',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '2px',
                              }}
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() =>
                                resolveReport.mutate({ reportId: report.id, action: 'dismiss' })
                              }
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                background: '#95a5a6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '2px',
                              }}
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {reportsData?.data.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                No reports.
              </p>
            )}
          </>
        )}

        {tab === 'bans' && (
          <>
            {bansLoading ? (
              <LoadingFallback />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>IP</th>
                    <th style={thStyle}>Board</th>
                    <th style={thStyle}>Reason</th>
                    <th style={thStyle}>Expires</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bansData?.data.map((ban) => (
                    <tr key={ban.id}>
                      <td style={tdStyle}>{ban.ip}</td>
                      <td style={tdStyle}>{ban.boardId === 'all' ? 'All' : `/${ban.boardId}/`}</td>
                      <td style={tdStyle}>{ban.reason}</td>
                      <td style={tdStyle}>{new Date(ban.expires).toLocaleDateString()}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '0.75rem',
                            background: ban.status === 'active' ? '#e74c3c' : '#95a5a6',
                            color: '#fff',
                          }}
                        >
                          {ban.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {tab === 'log' && (
          <>
            {logLoading ? (
              <LoadingFallback />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Action</th>
                    <th style={thStyle}>Board</th>
                    <th style={thStyle}>By</th>
                    <th style={thStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logData?.data.map((entry) => (
                    <tr key={entry.id}>
                      <td style={tdStyle}>{entry.action}</td>
                      <td style={tdStyle}>/{entry.boardId}/</td>
                      <td style={tdStyle}>{entry.performedBy}</td>
                      <td style={tdStyle}>
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

export default ModPage;
