import React from 'react';
import { useParams } from 'react-router-dom';
import MicrofrontendContainer from '../components/MicrofrontendContainer';

const ThreadViewerPage: React.FC = () => {
  const { boardId = '', threadId = '' } = useParams<{ boardId: string; threadId: string }>();

  return (
    <div className="thread-viewer-page">
      <MicrofrontendContainer
        name="board-viewer"
        props={{ boardId, threadId, mode: 'thread' }}
      />
    </div>
  );
};

export default ThreadViewerPage;
