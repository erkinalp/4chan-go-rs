import React from 'react';
import { useParams } from 'react-router-dom';
import MicrofrontendContainer from '../components/MicrofrontendContainer';

const MediaViewerPage: React.FC = () => {
  const { mediaId = '' } = useParams<{ mediaId: string }>();

  return (
    <div className="media-viewer-page">
      <MicrofrontendContainer
        name="media-viewer"
        props={{ mediaId }}
      />
    </div>
  );
};

export default MediaViewerPage;
