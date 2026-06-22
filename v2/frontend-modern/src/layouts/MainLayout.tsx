import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/hooks/redux';
import { selectIsAuthenticated, selectUser } from '@/features/auth/authSlice';
import ThemeSelector from '@/components/ThemeSelector';

const MainLayout: React.FC = () => {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: 'var(--header-bg)',
          color: 'var(--header-text)',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            to="/"
            style={{
              color: 'var(--header-text)',
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: '1rem',
            }}
          >
            4chan
          </Link>
          <nav style={{ display: 'flex', gap: '8px' }}>
            <Link to="/boards" style={{ color: 'var(--header-text)' }}>
              [Boards]
            </Link>
            {isAuthenticated && user?.role !== 'USER' && (
              <Link to="/mod" style={{ color: 'var(--header-text)' }}>
                [Mod]
              </Link>
            )}
            {isAuthenticated && user?.role === 'ADMIN' && (
              <Link to="/admin" style={{ color: 'var(--header-text)' }}>
                [Admin]
              </Link>
            )}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ThemeSelector />
          {isAuthenticated ? (
            <span>{user?.username}</span>
          ) : (
            <Link to="/signin" style={{ color: 'var(--header-text)' }}>
              [Sign In]
            </Link>
          )}
        </div>
      </header>

      <main style={{ flex: 1, padding: '16px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>

      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        All trademarks and copyrights on this page are owned by their respective parties.
      </footer>
    </div>
  );
};

export default MainLayout;
