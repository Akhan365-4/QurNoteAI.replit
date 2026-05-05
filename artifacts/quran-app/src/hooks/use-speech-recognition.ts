import { useState, useCallback, useRef, useEffect } from "react";

// Web Speech API type declarations (not always in TS lib.dom)
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}
interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: ISpeechRecognitionConstructor;
    webkitSpeechRecognition?: ISpeechRecognitionConstructor;
  }
}

export interface UseSpeechRecognitionOptions {
  lang?: string;
  onFinalResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  error: string | null;
}

export function useSpeechRecognition({
  lang = "ar-SA",
  onFinalResult,
  onError,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<ISpeechRecognition | null>(null);
  const activeRef = useRef(false);
  const onFinalResultRef = useRef(onFinalResult);
  const onErrorRef = useRef(onError);

  useEffect(() => { onFinalResultRef.current = onFinalResult; }, [onFinalResult]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (recRef.current) {
      recRef.current.stop();
      recRef.current = null;
    }
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    if (!isSupported) {
      const msg =
        "Speech recognition requires Chrome or Edge browser. Please switch browsers to use this feature.";
      setError(msg);
      onErrorRef.current?.(msg);
      return;
    }
    if (activeRef.current) return;
    activeRef.current = true;

    const SR = window.webkitSpeechRecognition ?? window.SpeechRecognition;
    if (!SR) {
      setError("Speech recognition not available.");
      activeRef.current = false;
      return;
    }

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text) onFinalResultRef.current?.(text);
        }
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") return;
      const msg =
        event.error === "not-allowed"
          ? "Microphone access denied. Please allow microphone access and try again."
          : `Recognition error: ${event.error}`;
      setError(msg);
      onErrorRef.current?.(msg);
      activeRef.current = false;
      setIsListening(false);
    };

    rec.onend = () => {
      if (activeRef.current && recRef.current === rec) {
        try {
          rec.start();
        } catch {
          activeRef.current = false;
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      activeRef.current = false;
      setError("Failed to start microphone. Please check browser permissions.");
    }
  }, [isSupported, lang]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      recRef.current?.stop();
    };
  }, []);

  return { isListening, isSupported, start, stop, error };
}
