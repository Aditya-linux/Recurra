import React, { useState } from 'react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackText: string;
  fallbackColor?: string;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  fallbackText,
  fallbackColor = 'var(--primary, #3B82F6)',
  className,
  style,
  ...props
}) => {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className={className}
        style={{
          ...style,
          background: fallbackColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 700,
          fontSize: 'clamp(16px, 40%, 24px)',
          width: style?.width || '100%',
          height: style?.height || '100%',
          textTransform: 'uppercase',
        }}
      >
        {fallbackText.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={src}
      className={className}
      style={style}
      onError={() => setError(true)}
      {...props}
    />
  );
};
