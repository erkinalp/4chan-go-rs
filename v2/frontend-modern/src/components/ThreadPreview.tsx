import React from 'react';
import { Link } from 'react-router-dom';
import type { Thread } from '@/types/api';
import PostCard from './PostCard';

interface ThreadPreviewProps {
  thread: Thread;
}

const ThreadPreview: React.FC<ThreadPreviewProps> = ({ thread }) => {
  const omittedPosts = thread.replyCount - (thread.lastReplies?.length ?? 0);
  const omittedImages =
    thread.imageCount -
    (thread.lastReplies?.filter((r) => r.file).length ?? 0) -
    (thread.op.file ? 1 : 0);

  return (
    <div style={{ marginBottom: '24px' }}>
      <PostCard post={thread.op} isOp />

      {omittedPosts > 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 4px 20px' }}>
          <Link to={`/board/${thread.boardId}/thread/${thread.id}`}>
            {omittedPosts} post{omittedPosts > 1 ? 's' : ''}
            {omittedImages > 0 &&
              ` and ${omittedImages} image${omittedImages > 1 ? 's' : ''}`}{' '}
            omitted. Click to view.
          </Link>
        </div>
      )}

      {thread.lastReplies?.map((reply) => (
        <div key={reply.id} style={{ marginLeft: '20px' }}>
          <PostCard post={reply} />
        </div>
      ))}

      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--border)',
          marginTop: '12px',
        }}
      />
    </div>
  );
};

export default ThreadPreview;
