import React, { useEffect, useCallback } from 'react';

interface ImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, onClose }) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        cursor: 'pointer',
      }}
    >
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '90vh',
          objectFit: 'contain',
          cursor: 'default',
        }}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          fontSize: '1.2rem',
          cursor: 'pointer',
        }}
        aria-label="Close"
      >
        &times;
      </button>
    </div>
  );
};

export default ImageViewer;
