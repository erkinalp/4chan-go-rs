import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useBoards } from '@/api/boards';
import LoadingFallback from '@/components/LoadingFallback';

const BoardsPage: React.FC = () => {
  const { data: boards, isLoading, error } = useBoards();
  const [search, setSearch] = useState('');
  const [showNSFW, setShowNSFW] = useState(true);

  const filtered = useMemo(() => {
    if (!boards) return [];
    return boards.filter((b) => {
      const matchesSearch =
        !search ||
        b.shortName.toLowerCase().includes(search.toLowerCase()) ||
        b.title.toLowerCase().includes(search.toLowerCase());
      const matchesNSFW = showNSFW || !b.isNSFW;
      return matchesSearch && matchesNSFW;
    });
  }, [boards, search, showNSFW]);

  if (isLoading) return <LoadingFallback />;

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
        Failed to load boards.
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h1 style={{ fontSize: '1.2rem', color: 'var(--accent)', marginBottom: '12px' }}>
        Board List
      </h1>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search boards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--input-border)',
            backgroundColor: 'var(--input-bg)',
            color: 'var(--text-primary)',
            flex: 1,
            maxWidth: '300px',
          }}
        />
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showNSFW}
            onChange={(e) => setShowNSFW(e.target.checked)}
            style={{ marginRight: '4px' }}
          />
          Show NSFW
        </label>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
            <th style={{ padding: '6px' }}>Board</th>
            <th style={{ padding: '6px' }}>Title</th>
            <th style={{ padding: '6px' }}>Category</th>
            <th style={{ padding: '6px', textAlign: 'right' }}>Threads</th>
            <th style={{ padding: '6px', textAlign: 'right' }}>Posts</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((board) => (
            <tr
              key={board.id}
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <td style={{ padding: '6px' }}>
                <Link to={`/board/${board.shortName}`} style={{ fontWeight: 'bold' }}>
                  /{board.shortName}/
                </Link>
              </td>
              <td style={{ padding: '6px', color: 'var(--text-primary)' }}>
                {board.title}
                {board.isNSFW && (
                  <span
                    style={{
                      marginLeft: '6px',
                      fontSize: '0.7rem',
                      padding: '1px 4px',
                      background: '#c0392b',
                      color: '#fff',
                      borderRadius: '2px',
                    }}
                  >
                    NSFW
                  </span>
                )}
              </td>
              <td style={{ padding: '6px', color: 'var(--text-secondary)' }}>{board.category}</td>
              <td style={{ padding: '6px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                {board.threadCount}
              </td>
              <td style={{ padding: '6px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                {board.postCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
          No boards found.
        </p>
      )}
    </motion.div>
  );
};

export default BoardsPage;
