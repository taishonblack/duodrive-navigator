import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

const sizeConfig = {
  sm: { dimension: 80, strokeWidth: 6, fontSize: "text-lg", labelSize: "text-xs" },
  md: { dimension: 120, strokeWidth: 8, fontSize: "text-2xl", labelSize: "text-sm" },
  lg: { dimension: 160, strokeWidth: 10, fontSize: "text-4xl", labelSize: "text-base" },
  xl: { dimension: 200, strokeWidth: 12, fontSize: "text-5xl", labelSize: "text-lg" },
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return "hsl(var(--score-excellent))";
  if (score >= 60) return "hsl(var(--score-good))";
  if (score >= 40) return "hsl(var(--score-caution))";
  return "hsl(var(--score-risky))";
};

const getScoreLabel = (score: number): string => {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Caution";
  return "Risky";
};

export function ScoreRing({
  score,
  size = "md",
  animated = true,
  showLabel = true,
  label,
  className,
}: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const config = sizeConfig[size];
  const radius = (config.dimension - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;
  const scoreColor = getScoreColor(score);

  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }

    let start: number | null = null;
    const duration = 1500;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(score * easeOut));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score, animated]);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={config.dimension}
        height={config.dimension}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={config.dimension / 2}
          cy={config.dimension / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={config.strokeWidth}
        />
        {/* Score circle */}
        <circle
          cx={config.dimension / 2}
          cy={config.dimension / 2}
          r={radius}
          fill="none"
          stroke={scoreColor}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-bold text-foreground", config.fontSize)}>
          {displayScore}
        </span>
        {showLabel && (
          <span className={cn("text-muted-foreground font-medium", config.labelSize)}>
            {label || getScoreLabel(score)}
          </span>
        )}
      </div>
    </div>
  );
}
