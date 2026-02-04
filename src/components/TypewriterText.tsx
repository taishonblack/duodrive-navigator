import { useState, useEffect, useRef } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number; // ms per word
  onComplete?: () => void;
}

export function TypewriterText({ text, speed = 80, onComplete }: TypewriterTextProps) {
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const words = text.split(" ");
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (displayedWords.length < words.length) {
      const timeout = setTimeout(() => {
        setDisplayedWords(prev => [...prev, words[prev.length]]);
      }, speed);
      return () => clearTimeout(timeout);
    } else if (displayedWords.length === words.length && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      setIsComplete(true);
      onComplete?.();
    }
  }, [displayedWords.length, words, speed, onComplete]);

  // Reset if text changes
  useEffect(() => {
    setDisplayedWords([]);
    setIsComplete(false);
    hasCompletedRef.current = false;
  }, [text]);

  return (
    <>
      {displayedWords.join(" ")}
      {!isComplete && (
        <span className="inline-block w-0.5 h-4 ml-0.5 bg-current animate-pulse align-middle" />
      )}
    </>
  );
}
