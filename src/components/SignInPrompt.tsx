import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";

interface SignInPromptProps {
  className?: string;
}

export function SignInPrompt({ className = "" }: SignInPromptProps) {
  return (
    <div className={`flex items-center justify-center gap-2 text-sm text-muted-foreground ${className}`}>
      <LogIn className="h-3.5 w-3.5" />
      <span>
        <Link to="/auth" className="text-primary hover:underline font-medium">
          Sign in
        </Link>
        {" "}to save and compare deals
      </span>
    </div>
  );
}
