import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface PillarCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  score?: number;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return "text-score-excellent";
  if (score >= 60) return "text-score-good";
  if (score >= 40) return "text-score-caution";
  return "text-score-risky";
};

export function PillarCard({
  icon: Icon,
  title,
  description,
  score,
  onClick,
  className,
  style,
}: PillarCardProps) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        "group relative p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition-all duration-300",
        onClick && "cursor-pointer hover:border-primary/30",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <Icon className="h-6 w-6" />
        </div>
        {score !== undefined && (
          <span className={cn("text-2xl font-bold", getScoreColor(score))}>
            {score}
          </span>
        )}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      {onClick && (
        <span className="mt-4 inline-flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          See formula →
        </span>
      )}
    </div>
  );
}
