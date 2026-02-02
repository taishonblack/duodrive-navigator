import { Bot, MessageSquare, Upload, AlertCircle, Sparkles } from "lucide-react";

export function HowToUseHenry() {
  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">How to use DuoDrive</h3>
          <p className="text-muted-foreground mt-1">
            Henry is here to help you evaluate a real dealership deal — not sell you a car.
          </p>
        </div>
      </div>

      <div className="space-y-4 pl-11">
        <div className="flex items-start gap-2">
          <MessageSquare className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <p className="text-muted-foreground">
            Start by typing the car you're considering (year, make, model, and trim if you know it).
          </p>
        </div>

        <div className="flex items-start gap-2">
          <Upload className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <p className="text-muted-foreground">
            You can also paste numbers from a quote, or upload a photo/screenshot — Henry will extract the details.
          </p>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <p className="text-muted-foreground">
          <strong className="text-foreground">As you chat, Henry will:</strong>
        </p>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            Build your deal step-by-step
          </li>
          <li className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            Explain terms like APR, fees, and down payment
          </li>
          <li className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            Flag anything risky
          </li>
          <li className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            Tell you when there's enough info to evaluate
          </li>
        </ul>
      </div>

      <div className="space-y-2">
        <p className="font-medium text-foreground">Examples you can type:</p>
        <div className="space-y-1.5">
          <code className="block bg-muted px-2 py-1 rounded text-xs text-muted-foreground">
            "2025 Lexus TX 350 F Sport for $74,000"
          </code>
          <code className="block bg-muted px-2 py-1 rounded text-xs text-muted-foreground">
            "$5k down, 6.9% APR, 60 months"
          </code>
          <code className="block bg-muted px-2 py-1 rounded text-xs text-muted-foreground">
            "Dealer fee $995 + taxes"
          </code>
        </div>
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        <strong>Tip:</strong> You can stop anytime. Nothing here locks you in.
      </p>
    </div>
  );
}
