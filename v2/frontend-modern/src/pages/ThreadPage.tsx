import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useThread } from '@/api/threads';
import { usePosts, useCreatePost } from '@/api/posts';
import PostCard from '@/components/PostCard';
import ReplyForm from '@/components/ReplyForm';
import LoadingFallback from '@/components/LoadingFallback';

const ThreadPage: React.FC = () => {
  const { boardId = '', threadId = '' } = useParams<{ boardId: string; threadId: string }>();
  const { data: thread, isLoading: threadLoading } = useThread(threadId);
  const { data: posts, isLoading: postsLoading } = usePosts(threadId);
  const createPost = useCreatePost();

  const handleReply = (formData: FormData) => {
    createPost.mutate({ threadId, formData });
  };

  if (threadLoading || postsLoading) return <LoadingFallback />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ marginBottom: '12px', fontSize: '0.8rem' }}>
        <Link to={`/board/${boardId}`}>[Return]</Link>
        {' | '}
        <Link to={`/board/${boardId}/catalog`}>[Catalog]</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        <ReplyForm
          boardId={boardId}
          threadId={threadId}
          onSubmit={handleReply}
          isLoading={createPost.isPending}
        />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: '16px' }} />

      {thread && (
        <div style={{ marginBottom: '16px' }}>
          <PostCard post={thread.op} isOp />
          {thread.isSticky && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
              [Sticky]
            </span>
          )}
          {thread.isClosed && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
              [Closed]
            </span>
          )}
        </div>
      )}

      {posts?.map((post) => (
        <div key={post.id} style={{ marginLeft: '20px', marginBottom: '4px' }}>
          <PostCard post={post} />
        </div>
      ))}
    </motion.div>
  );
};

export default ThreadPage;
