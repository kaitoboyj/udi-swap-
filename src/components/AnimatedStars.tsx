import React from 'react';

const AnimatedStars: React.FC = () => {
  const stars = Array.from({ length: 90 }).map((_, i) => {
    const left = Math.random() * 100;
    const top = Math.random() * 100;
    const duration = 10 + Math.random() * 18;
    const delay = -Math.random() * 10;
    const dx = `${Math.random() * 100 - 50}px`;
    const dy = `${Math.random() * 100 - 50}px`;
    const style: React.CSSProperties = {
      left: `${left}%`,
      top: `${top}%`,
      ['--duration' as any]: `${duration}s`,
      ['--delay' as any]: `${delay}s`,
      ['--dx' as any]: dx,
      ['--dy' as any]: dy,
    };
    return <div key={i} className="star" style={style} />;
  });
  return <div className="stars">{stars}</div>;
};

export default AnimatedStars;