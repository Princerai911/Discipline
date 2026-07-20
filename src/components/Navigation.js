"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Today' },
    { href: '/goals', label: 'Goals' },
    { href: '/stats', label: 'Stats' },
    { href: '/notes', label: 'Notes' },
  ];

  return (
    <nav style={{ display: 'flex', gap: '0.75rem', background: 'var(--card)', padding: '0.75rem 1rem', borderRadius: '999px', border: '1px solid var(--card-border)', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '350px' }}>
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link 
            key={link.href} 
            href={link.href}
            style={{ 
              color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)', 
              textDecoration: 'none', 
              fontWeight: isActive ? 700 : 500, 
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
