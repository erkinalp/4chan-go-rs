import React, { useEffect, useState } from 'react';
import { useCreateReport } from '@/api/moderation';
import type { ReportReason } from '@/types/api';

interface ReportFormProps {
  postId?: string;
  threadId?: string;
  boardId?: string;
  postNumber?: number;
  onClose: () => void;
}

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'ILLEGAL', label: 'Illegal content' },
  { value: 'SPAM', label: 'Spam or flooding' },
  { value: 'OFFENSIVE', label: 'Offensive content' },
  { value: 'OFF_TOPIC', label: 'Off-topic' },
  { value: 'OTHER', label: 'Other rule violation' },
];

const ReportForm: React.FC<ReportFormProps> = ({
  postId,
  threadId,
  boardId,
  postNumber,
  onClose,
}) => {
  const [reason, setReason] = useState<ReportReason>('OTHER');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const createReport = useCreateReport();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createReport.mutate({
      reason,
      additionalInfo: additionalInfo.trim() || undefined,
      postId,
      threadId,
    });
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    marginBottom: '4px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 6px',
    border: '1px solid var(--input-border)',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Report post"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="report-form"
        style={{
          background: 'var(--bg-post)',
          border: '1px solid var(--border)',
          padding: '16px',
          width: '100%',
          maxWidth: '360px',
        }}
      >
        <h2
          style={{
            fontSize: '1rem',
            color: 'var(--accent)',
            marginBottom: '12px',
          }}
        >
          Report{postNumber ? ` No.${postNumber}` : ''}
          {boardId ? ` on /${boardId}/` : ''}
        </h2>

        {createReport.isSuccess ? (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Report submitted. Thank you.
            </p>
            <div style={{ textAlign: 'right', marginTop: '12px' }}>
              <button type="button" onClick={onClose} style={{ cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '10px' }}>
              <label htmlFor="report-reason" style={labelStyle}>
                Reason
              </label>
              <select
                id="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                style={inputStyle}
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label htmlFor="report-info" style={labelStyle}>
                Details <span style={{ fontWeight: 'normal' }}>(optional)</span>
              </label>
              <textarea
                id="report-info"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {createReport.isError && (
              <p style={{ fontSize: '0.8rem', color: 'var(--link-hover)', marginBottom: '8px' }}>
                Failed to submit report. Please try again.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={onClose} style={{ cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={createReport.isPending}
                style={{
                  cursor: createReport.isPending ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {createReport.isPending ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

export default ReportForm;
