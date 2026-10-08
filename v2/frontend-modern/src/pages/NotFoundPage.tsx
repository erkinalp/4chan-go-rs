import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const NotFoundPage: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    style={{ textAlign: 'center', paddingTop: '60px' }}
  >
    <h1 style={{ fontSize: '3rem', color: 'var(--accent)', marginBottom: '8px' }}>404</h1>
    <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
      Page not found.
    </p>
    <Link to="/" style={{ color: 'var(--link)' }}>
      Go back home
    </Link>
  </motion.div>
);

export default NotFoundPage;
