import React from 'react';
import MicrofrontendContainer from '../components/MicrofrontendContainer';

const ModeratorDashboard: React.FC = () => {
  return (
    <div className="moderator-dashboard">
      <MicrofrontendContainer name="moderation" />
    </div>
  );
};

export default ModeratorDashboard;
