import React from 'react';
import { useParams } from 'react-router-dom';
import MicrofrontendContainer from '../components/MicrofrontendContainer';

interface PostCreatorPageProps {
  mode: 'new' | 'reply';
}

const PostCreatorPage: React.FC<PostCreatorPageProps> = ({ mode }) => {
  const { boardId = '', threadId = '' } = useParams<{ boardId: string; threadId: string }>();

  return (
    <div className="post-creator-page">
      <MicrofrontendContainer
        name="post-creator"
        props={{ boardId, threadId: mode === 'reply' ? threadId : '', mode }}
      />
    </div>
  );
};

export default PostCreatorPage;
