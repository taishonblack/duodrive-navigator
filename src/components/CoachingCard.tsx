import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, LucideIcon } from "lucide-react";

interface CoachingCardProps {
  title: string;
  price: number;
  duration: string;
  features: string[];
  popular?: boolean;
  icon?: LucideIcon;
  onGetStarted?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function CoachingCard({
  title,
  price,
  duration,
  features,
  popular = false,
  icon: Icon,
  onGetStarted,
  className,
  style,
}: CoachingCardProps) {
  return (
    <div
      style={style}
      className={cn(
        "relative p-6 rounded-2xl bg-card border shadow-card hover:shadow-elevated transition-all duration-300",
        popular ? "border-primary" : "border-border",
        className
      )}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded-full shadow-soft">
            Most Popular
          </span>
        </div>
      )}
      <div className="text-center mb-6">
        {Icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mx-auto mb-3">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{duration}</p>
      </div>
      <div className="text-center mb-6">
        <span className="text-4xl font-bold text-foreground">${price}</span>
      </div>
      <ul className="space-y-3 mb-6">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success shrink-0 mt-0.5">
              <Check className="h-3 w-3" />
            </div>
            <span className="text-sm text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>
      <Button
        className="w-full"
        variant={popular ? "default" : "outline"}
        onClick={onGetStarted}
      >
        Get Started
      </Button>
    </div>
  );
}