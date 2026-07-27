'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';

interface LogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

export function Logo({ size = 32, className = '', alt = 'Arkavena Logo' }: LogoProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-[10px] bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm shrink-0 ${className}`}
        style={{ width: size, height: size }}
        title={alt}
      >
        <Building2 size={Math.round(size * 0.55)} className="text-white" />
      </div>
    );
  }

  return (
    <img
      src="/logo.png"
      alt={alt}
      width={size}
      height={size}
      onError={() => setError(true)}
      className={`rounded-[10px] object-cover shadow-sm shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
