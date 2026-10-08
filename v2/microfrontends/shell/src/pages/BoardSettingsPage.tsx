import React from 'react';
import { useParams } from 'react-router-dom';

const BoardSettingsPage: React.FC = () => {
  const { boardId = '' } = useParams<{ boardId: string }>();

  return (
    <div style={{ padding: '16px' }}>
      <h1 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>
        Board Settings: /{boardId}/
      </h1>
      <p>Configure board settings, rules, and moderation options.</p>
    </div>
  );
};

export default BoardSettingsPage;
