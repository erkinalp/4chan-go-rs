import React, { useState, useRef } from 'react';

interface ReplyFormProps {
  boardId: string;
  threadId?: string;
  onSubmit: (formData: FormData) => void;
  isLoading?: boolean;
}

const ReplyForm: React.FC<ReplyFormProps> = ({ boardId, threadId, onSubmit, isLoading = false }) => {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !fileInputRef.current?.files?.length) return;

    const formData = new FormData();
    formData.append('boardId', boardId);
    if (threadId) formData.append('threadId', threadId);
    if (name.trim()) formData.append('name', name);
    if (subject.trim()) formData.append('subject', subject);
    formData.append('message', message);

    const file = fileInputRef.current?.files?.[0];
    if (file) formData.append('file', file);

    onSubmit(formData);
    setMessage('');
    setSubject('');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--bg-post)',
        border: '1px solid var(--border)',
        padding: '12px',
        marginBottom: '16px',
        maxWidth: '500px',
      }}
    >
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ padding: '2px 4px', fontSize: '0.85rem', fontWeight: 'bold' }}>Name</td>
            <td style={{ padding: '2px 4px' }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Anonymous"
                style={inputStyle}
              />
            </td>
          </tr>
          {!threadId && (
            <tr>
              <td style={{ padding: '2px 4px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                Subject
              </td>
              <td style={{ padding: '2px 4px', display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    padding: '2px 12px',
                    cursor: 'pointer',
                  }}
                >
                  {isLoading ? 'Posting...' : 'Post'}
                </button>
              </td>
            </tr>
          )}
          <tr>
            <td style={{ padding: '2px 4px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              Comment
            </td>
            <td style={{ padding: '2px 4px' }}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                style={{ ...inputStyle, resize: 'vertical' }}
                required
              />
            </td>
          </tr>
          <tr>
            <td style={{ padding: '2px 4px', fontSize: '0.85rem', fontWeight: 'bold' }}>File</td>
            <td style={{ padding: '2px 4px' }}>
              <input type="file" ref={fileInputRef} accept="image/*,video/webm" />
            </td>
          </tr>
          {threadId && (
            <tr>
              <td />
              <td style={{ padding: '2px 4px' }}>
                <button type="submit" disabled={isLoading} style={{ cursor: 'pointer' }}>
                  {isLoading ? 'Posting...' : 'Post Reply'}
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </form>
  );
};

export default ReplyForm;
