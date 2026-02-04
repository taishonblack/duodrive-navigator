import { Bot, MessageSquare, Upload, AlertCircle, Sparkles, Zap, Camera } from "lucide-react";

export function HowToUseQuinn() {
  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">How to use DuoDrive</h3>
          <p className="text-muted-foreground mt-1">
            Quinn helps you evaluate a real dealership deal — not sell you a car.
          </p>
        </div>
      </div>

      <div className="space-y-4 pl-11">
        <div className="flex items-start gap-2">
          <MessageSquare className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <p className="text-muted-foreground">
            Start by typing the car you're considering (year, make, model — trim if you know it).
          </p>
        </div>

        <div className="flex items-start gap-2">
          <Upload className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <p className="text-muted-foreground">
            Paste numbers from the quote (price, down payment, APR, term, fees).
          </p>
        </div>

        <div className="flex items-start gap-2">
          <Camera className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <p className="text-muted-foreground">
            Upload a photo of the window sticker or buyer's order — Quinn will extract details.
          </p>
        </div>
      </div>

      {/* At the dealership tip */}
      <div className="bg-primary/10 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">At the dealership?</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Tell Quinn "I'm at the dealership" for faster, tactical answers and scripts to say.
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <p className="text-muted-foreground">
          <strong className="text-foreground">As you chat, Quinn will:</strong>
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
            Flag anything risky or overpriced
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
            "2026 Buick Envista Preferred — $27,700"
          </code>
          <code className="block bg-muted px-2 py-1 rounded text-xs text-muted-foreground">
            "$2k down, 6.9% APR, 60 months"
          </code>
          <code className="block bg-muted px-2 py-1 rounded text-xs text-muted-foreground">
            "Doc fee $699 + taxes"
          </code>
        </div>
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        <strong>Tip:</strong> You can pause anytime. Nothing here locks you in.
      </p>
    </div>
  );
}
