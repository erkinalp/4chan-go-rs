import React from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Breadcrumb trail: every item but the last links to `to`; the last is the
 * current location and renders as plain text.
 */
const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => (
  <nav className="breadcrumbs" aria-label="Breadcrumb">
    {items.map((item, i) => {
      const isLast = i === items.length - 1;
      return (
        <React.Fragment key={`${item.label}-${i}`}>
          {i > 0 && <span className="breadcrumbs-sep"> / </span>}
          {item.to && !isLast ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span aria-current={isLast ? 'page' : undefined}>{item.label}</span>
          )}
        </React.Fragment>
      );
    })}
  </nav>
);

export default Breadcrumbs;
