'use client';

import { BreadcrumbItem } from '@/lib/types/files';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
}

export default function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
      <button
        onClick={() => onNavigate('')}
        className="hover:text-blue-600 transition-colors"
      >
        Home
      </button>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          <span className="text-gray-400">/</span>
          <button
            onClick={() => onNavigate(item.path)}
            className={`hover:text-blue-600 transition-colors ${
              index === items.length - 1 ? 'text-gray-800 font-medium' : ''
            }`}
          >
            {item.name}
          </button>
        </div>
      ))}
    </nav>
  );
}