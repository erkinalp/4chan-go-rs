import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>4chan</h1>
      <p style={{ marginBottom: '24px' }}>Choose a board to get started.</p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/b">Random</Link>
        <Link to="/a">Anime &amp; Manga</Link>
        <Link to="/v">Video Games</Link>
        <Link to="/g">Technology</Link>
        <Link to="/pol">Politically Incorrect</Link>
      </div>
    </div>
  );
};

export default HomePage;
