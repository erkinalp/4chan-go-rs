import React, { useState } from 'react';
import type { Post } from '@/types/api';
import ImageViewer from './ImageViewer';

interface PostCardProps {
  post: Post;
  isOp?: boolean;
}

function renderMessage(message: string): React.ReactNode {
  return message.split('\n').map((line, i) => {
    if (line.startsWith('>') && !line.startsWith('>>')) {
      return (
        <span key={i} className="greentext">
          {line}
          <br />
        </span>
      );
    }
    const parts = line.split(/(>>(\d+))/g);
    const elements: React.ReactNode[] = [];
    for (let j = 0; j < parts.length; j += 3) {
      if (parts[j]) elements.push(parts[j]);
      if (parts[j + 1]) {
        elements.push(
          <a key={`${i}-${j}`} href={`#p${parts[j + 2]}`} className="quotelink">
            {parts[j + 1]}
          </a>
        );
      }
    }
    return (
      <React.Fragment key={i}>
        {elements}
        <br />
      </React.Fragment>
    );
  });
}

const PostCard: React.FC<PostCardProps> = ({ post, isOp = false }) => {
  const [showViewer, setShowViewer] = useState(false);
  const date = new Date(post.createdAt);
  const dateStr = date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      id={`p${post.postNumber}`}
      style={{
        background: 'var(--bg-post)',
        border: '1px solid var(--border)',
        borderRadius: '2px',
        padding: '8px 12px',
        marginBottom: isOp ? '0' : '4px',
        display: 'inline-block',
        maxWidth: '100%',
      }}
    >
      <div style={{ fontSize: '0.8rem', marginBottom: '4px' }}>
        {post.subject && (
          <span style={{ color: 'var(--subject-color)', fontWeight: 'bold', marginRight: '6px' }}>
            {post.subject}
          </span>
        )}
        <span style={{ color: 'var(--name-color)', fontWeight: 'bold' }}>
          {post.name || 'Anonymous'}
        </span>
        {post.tripcode && (
          <span style={{ color: 'var(--tripcode-color)', marginLeft: '4px' }}>
            !{post.tripcode}
          </span>
        )}
        <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>{dateStr}</span>
        <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
          No.{post.postNumber}
        </span>
      </div>

      {post.file && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
            File:{' '}
            <a href={post.file.fileUrl} target="_blank" rel="noopener noreferrer">
              {post.file.originalFilename}
            </a>{' '}
            ({Math.round(post.file.size / 1024)} KB, {post.file.width}x{post.file.height})
          </div>
          <img
            src={post.file.thumbnailUrl}
            alt={post.file.originalFilename}
            style={{
              cursor: 'pointer',
              maxHeight: isOp ? '250px' : '125px',
              filter: post.isSpoilered ? 'blur(10px)' : 'none',
            }}
            onClick={() => setShowViewer(true)}
          />
        </div>
      )}

      <div style={{ fontSize: '0.85rem', wordBreak: 'break-word' }}>
        {renderMessage(post.message)}
      </div>

      {showViewer && post.file && (
        <ImageViewer
          src={post.file.fileUrl}
          alt={post.file.originalFilename}
          onClose={() => setShowViewer(false)}
        />
      )}
    </div>
  );
};

export default PostCard;
