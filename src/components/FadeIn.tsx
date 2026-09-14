import React from 'react';

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const FadeIn: React.FC<FadeInProps> = ({ children, className = '', delay = 0 }) => (
  <div className={`animate-fade-in-up ${className}`} style={delay ? { animationDelay: `${delay}ms` } : undefined}>
    {children}
  </div>
);
