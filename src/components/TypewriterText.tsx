import { useState, useEffect } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number; // ms per word
  onComplete?: () => void;
}

export function TypewriterText({ text, speed = 80, onComplete }: TypewriterTextProps) {
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const words = text.split(" ");

  useEffect(() => {
    if (displayedWords.length < words.length) {
      const timeout = setTimeout(() => {
        setDisplayedWords(words.slice(0, displayedWords.length + 1));
      }, speed);
      return () => clearTimeout(timeout);
    } else if (displayedWords.length === words.length && onComplete) {
      onComplete();
    }
  }, [displayedWords, words, speed, onComplete]);

  return <>{displayedWords.join(" ")}</>;
}
