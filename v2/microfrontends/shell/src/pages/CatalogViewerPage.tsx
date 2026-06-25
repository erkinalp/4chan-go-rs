import React from 'react';
import { useParams } from 'react-router-dom';
import MicrofrontendContainer from '../components/MicrofrontendContainer';

const CatalogViewerPage: React.FC = () => {
  const { boardId = '' } = useParams<{ boardId: string }>();

  return (
    <div className="catalog-viewer-page">
      <MicrofrontendContainer
        name="catalog-viewer"
        props={{ boardId }}
      />
    </div>
  );
};

export default CatalogViewerPage;
