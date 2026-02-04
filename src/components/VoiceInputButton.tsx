import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  atDealership?: boolean;
}

const MIC_DISCLOSURE_KEY = "duodrive_mic_disclosure_shown";

export function VoiceInputButton({
  onTranscript,
  disabled = false,
  atDealership = false,
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  // Check if speech recognition is supported
  const isSpeechSupported = typeof window !== "undefined" && 
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = () => {
    if (!isSpeechSupported) {
      toast({
        title: "Not Supported",
        description: "Voice input isn't supported in this browser.",
        variant: "destructive",
      });
      return;
    }

    // Check if we need to show disclosure
    const hasSeenDisclosure = localStorage.getItem(MIC_DISCLOSURE_KEY);
    if (!hasSeenDisclosure) {
      setShowDisclosure(true);
      setPendingStart(true);
      return;
    }

    initiateListening();
  };

  const initiateListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onstart = () => {
      setIsListening(true);
      toast({
        title: "Listening...",
        description: atDealership 
          ? "Say the numbers you see. Be mindful of private info around you."
          : "Speak your deal details. I'll transcribe them for Quinn.",
      });
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      
      if (event.error === "not-allowed") {
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access in your browser settings.",
          variant: "destructive",
        });
      } else if (event.error !== "aborted") {
        toast({
          title: "Voice Input Error",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) {
        onTranscript(finalTranscript.trim());
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleDisclosureAccept = () => {
    localStorage.setItem(MIC_DISCLOSURE_KEY, "true");
    setShowDisclosure(false);
    if (pendingStart) {
      setPendingStart(false);
      initiateListening();
    }
  };

  const handleDisclosureCancel = () => {
    setShowDisclosure(false);
    setPendingStart(false);
  };

  if (!isSpeechSupported) {
    return null; // Don't render if not supported
  }

  return (
    <>
      <Button
        type="button"
        variant={isListening ? "destructive" : "ghost"}
        size="icon"
        onClick={isListening ? stopListening : startListening}
        disabled={disabled}
        className="h-10 w-10 shrink-0"
        title={isListening ? "Stop listening" : "Speak your deal details"}
      >
        {isListening ? (
          <div className="relative">
            <MicOff className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </div>
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>

      <AlertDialog open={showDisclosure} onOpenChange={setShowDisclosure}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Mic is on
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Your voice will be transcribed and sent to Quinn so they can help evaluate your deal.
              </p>
              {atDealership && (
                <p className="text-amber-600 dark:text-amber-400">
                  Just a heads-up: be mindful of private info around you. Share only what you're comfortable with.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDisclosureCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDisclosureAccept}>
              Start speaking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
