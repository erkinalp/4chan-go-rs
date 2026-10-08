import React from 'react';

const LoadingFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '200px',
      color: 'var(--text-muted)',
      fontSize: '0.9rem',
    }}
  >
    Loading...
  </div>
);

export default LoadingFallback;
