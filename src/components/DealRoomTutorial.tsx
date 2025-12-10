import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bot, FileText, Calculator, BookOpen, BarChart3, X, ChevronRight, Sparkles } from "lucide-react";

const TUTORIAL_SEEN_KEY = "duodrive_tutorial_seen";

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    icon: <Bot className="h-8 w-8" />,
    title: "Start with AI Copilot",
    description: "Paste your dealer quote, screenshot, or type the deal details. Our AI extracts everything and calculates your score automatically."
  },
  {
    icon: <FileText className="h-8 w-8" />,
    title: "Review Your Deal",
    description: "Check the extracted details in 'The Deal' tab. Add missing info like your income to get a more accurate score."
  },
  {
    icon: <Calculator className="h-8 w-8" />,
    title: "Understand the Numbers",
    description: "The Calculator shows your True Market Price, monthly payments, and how the deal fits your budget."
  },
  {
    icon: <BookOpen className="h-8 w-8" />,
    title: "Learn the Lingo",
    description: "Don't know a term? The Glossary explains 130+ car-buying terms so you never feel lost."
  },
  {
    icon: <BarChart3 className="h-8 w-8" />,
    title: "Get Your Score",
    description: "See your DuoDrive Score (0-100), personalized recommendations, and negotiation scripts to get the best deal."
  }
];

export function DealRoomTutorial() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if user has seen the tutorial
    const hasSeenTutorial = localStorage.getItem(TUTORIAL_SEEN_KEY);
    if (!hasSeenTutorial) {
      // Small delay to let the page load first
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "true");
    setIsVisible(false);
  };

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  if (!isVisible) return null;

  const step = tutorialSteps[currentStep];
  const isLastStep = currentStep === tutorialSteps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg mx-4 bg-card rounded-2xl shadow-elevated overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors z-10"
          aria-label="Close tutorial"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-br from-primary/20 via-accent/30 to-primary/10 p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Sparkles className="h-8 w-8" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to Deal Room</h2>
          <p className="text-muted-foreground">Let me show you how to get the best car deal</p>
        </div>

        {/* Step Content */}
        <div className="p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {step.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {currentStep + 1}. {step.title}
              </h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {tutorialSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  index === currentStep 
                    ? "w-8 bg-primary" 
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="flex-1"
            >
              Skip
            </Button>
            <Button
              onClick={handleNext}
              className="flex-1"
            >
              {isLastStep ? "Get Started" : "Next"}
              {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export function to reset tutorial (useful for testing)
export function resetTutorial() {
  localStorage.removeItem(TUTORIAL_SEEN_KEY);
}
