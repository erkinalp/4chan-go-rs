import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useBoard } from '@/api/boards';
import { useThreads } from '@/api/threads';
import LoadingFallback from '@/components/LoadingFallback';
import type { Thread } from '@/types/api';

const CatalogCard: React.FC<{ thread: Thread; boardId: string }> = ({ thread, boardId }) => (
  <Link
    to={`/board/${boardId}/thread/${thread.id}`}
    style={{
      display: 'block',
      border: '1px solid var(--border)',
      background: 'var(--bg-post)',
      padding: '4px',
      textDecoration: 'none',
      overflow: 'hidden',
      height: '260px',
    }}
  >
    {thread.op.file && (
      <img
        src={thread.op.file.thumbnailUrl}
        alt=""
        style={{
          width: '100%',
          height: '150px',
          objectFit: 'cover',
          display: 'block',
          filter: thread.op.isSpoilered ? 'blur(10px)' : 'none',
        }}
      />
    )}
    {!thread.op.file && (
      <div
        style={{
          width: '100%',
          height: '150px',
          background: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        No image
      </div>
    )}
    <div style={{ padding: '4px' }}>
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          marginBottom: '2px',
        }}
      >
        R: {thread.replyCount} / I: {thread.imageCount}
      </div>
      {thread.subject && (
        <div
          style={{
            fontWeight: 'bold',
            fontSize: '0.8rem',
            color: 'var(--subject-color)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {thread.subject}
        </div>
      )}
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {thread.op.message}
      </div>
    </div>
  </Link>
);

const CatalogPage: React.FC = () => {
  const { boardId = '' } = useParams<{ boardId: string }>();
  const { data: board } = useBoard(boardId);
  const { data: threadsData, isLoading, error } = useThreads(boardId);

  if (isLoading) return <LoadingFallback />;

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
        Failed to load catalog.
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <h1 style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>
          /{boardId}/ - {board?.title ?? boardId} - Catalog
        </h1>
        <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
          <Link to={`/board/${boardId}`}>[Return]</Link>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '8px',
        }}
      >
        {threadsData?.data.map((thread) => (
          <CatalogCard key={thread.id} thread={thread} boardId={boardId} />
        ))}
      </div>

      {(!threadsData?.data || threadsData.data.length === 0) && (
        <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          No threads.
        </p>
      )}
    </motion.div>
  );
};

export default CatalogPage;
