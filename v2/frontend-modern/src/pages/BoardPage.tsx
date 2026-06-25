import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useBoard } from '@/api/boards';
import { useThreads, useCreateThread } from '@/api/threads';
import ThreadPreview from '@/components/ThreadPreview';
import ReplyForm from '@/components/ReplyForm';
import LoadingFallback from '@/components/LoadingFallback';

const BoardPage: React.FC = () => {
  const { boardId = '' } = useParams<{ boardId: string }>();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);

  const { data: board } = useBoard(boardId);
  const { data: threadsData, isLoading, error } = useThreads(boardId, page);
  const createThread = useCreateThread();

  const handleNewThread = (formData: FormData) => {
    createThread.mutate(
      { boardId, formData },
      { onSuccess: () => setShowForm(false) }
    );
  };

  if (isLoading) return <LoadingFallback />;

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
        Failed to load threads.
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '1.3rem', color: 'var(--accent)' }}>
          /{boardId}/ - {board?.title ?? boardId}
        </h1>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          <Link to={`/board/${boardId}/catalog`}>[Catalog]</Link>
          {' | '}
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--link)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            [Start a New Thread]
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <ReplyForm boardId={boardId} onSubmit={handleNewThread} isLoading={createThread.isPending} />
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: '16px' }} />

      {threadsData?.data.map((thread) => (
        <ThreadPreview key={thread.id} thread={thread} />
      ))}

      {threadsData && threadsData.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
          {Array.from({ length: threadsData.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                padding: '4px 10px',
                background: p === page ? 'var(--accent)' : 'var(--bg-post)',
                color: p === page ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default BoardPage;
