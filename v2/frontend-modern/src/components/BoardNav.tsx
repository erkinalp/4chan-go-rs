import React from 'react';
import { Link } from 'react-router-dom';
import { useBoards } from '@/api/boards';

/**
 * Horizontal board-list navigation strip, like the classic board bar.
 * Renders nothing while boards are loading or unavailable.
 */
const BoardNav: React.FC = () => {
  const { data: boards } = useBoards();

  if (!boards?.length) return null;

  return (
    <nav className="board-nav" aria-label="Board list">
      [
      {boards.map((board, i) => (
        <React.Fragment key={board.id}>
          {i > 0 && ' / '}
          <Link to={`/board/${board.shortName}`} title={board.title}>
            {board.shortName}
          </Link>
        </React.Fragment>
      ))}
      ]
    </nav>
  );
};

export default BoardNav;
