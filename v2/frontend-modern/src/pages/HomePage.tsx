import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useBoards } from '@/api/boards';
import LoadingFallback from '@/components/LoadingFallback';
import type { Board } from '@/types/api';

function groupByCategory(boards: Board[]): Record<string, Board[]> {
  const groups: Record<string, Board[]> = {};
  for (const board of boards) {
    const cat = board.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(board);
  }
  return groups;
}

const HomePage: React.FC = () => {
  const { data: boards, isLoading, error } = useBoards();

  if (isLoading) return <LoadingFallback />;

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
        Failed to load boards. Please try again later.
      </div>
    );
  }

  const grouped = groupByCategory(boards ?? []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>4chan</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Choose a board below to get started.
        </p>
      </div>

      {Object.entries(grouped).map(([category, catBoards]) => (
        <div key={category} style={{ marginBottom: '20px' }}>
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 'bold',
              color: 'var(--accent)',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '4px',
              marginBottom: '8px',
            }}
          >
            {category}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '8px',
            }}
          >
            {catBoards.map((board) => (
              <Link
                key={board.id}
                to={`/board/${board.shortName}`}
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  background: 'var(--bg-post)',
                  border: '1px solid var(--border)',
                  borderRadius: '2px',
                  textDecoration: 'none',
                }}
              >
                <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>
                  /{board.shortName}/
                </span>
                <span style={{ color: 'var(--text-primary)', marginLeft: '6px' }}>
                  - {board.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
};

export default HomePage;
