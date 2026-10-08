import React, { useEffect, useCallback, useState } from 'react';

interface ImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, onClose }) => {
  const [zoomed, setZoomed] = useState(false);

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
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 9999,
        cursor: 'pointer',
        display: zoomed ? 'block' : 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: zoomed ? 'auto' : 'hidden',
      }}
    >
      <img
        src={src}
        alt={alt}
        onClick={(e) => {
          e.stopPropagation();
          setZoomed((z) => !z);
        }}
        style={
          zoomed
            ? {
                display: 'block',
                maxWidth: 'none',
                maxHeight: 'none',
                margin: '16px auto',
                cursor: 'zoom-out',
              }
            : {
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                cursor: 'zoom-in',
              }
        }
      />
      <button
        onClick={onClose}
        style={{
          position: 'fixed',
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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#ddd',
          fontSize: '0.75rem',
          background: 'rgba(0,0,0,0.6)',
          padding: '4px 10px',
          borderRadius: '3px',
          cursor: 'default',
          whiteSpace: 'nowrap',
        }}
      >
        Click image to {zoomed ? 'fit' : 'zoom'} &middot; Esc to close
      </div>
    </div>
  );
};

export default ImageViewer;
