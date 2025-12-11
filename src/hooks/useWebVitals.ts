import { useEffect } from "react";

interface WebVitalsMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
}

// Core Web Vitals thresholds
const thresholds = {
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  INP: { good: 200, poor: 500 },
  LCP: { good: 2500, poor: 4000 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

type MetricName = keyof typeof thresholds;

const getRating = (name: MetricName, value: number): "good" | "needs-improvement" | "poor" => {
  const threshold = thresholds[name];
  if (!threshold) return "good";
  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
};

// Store metrics for access
const metrics: Record<string, WebVitalsMetric> = {};

export function getWebVitals() {
  return { ...metrics };
}

// Optional callback for reporting metrics
type ReportCallback = (metric: WebVitalsMetric) => void;

let reportCallback: ReportCallback | null = null;

export function setWebVitalsReporter(callback: ReportCallback) {
  reportCallback = callback;
}

const reportMetric = (metric: WebVitalsMetric) => {
  metrics[metric.name] = metric;
  
  // Log to console in development
  if (import.meta.env.DEV) {
    const color = metric.rating === "good" ? "#0cce6b" : metric.rating === "needs-improvement" ? "#ffa400" : "#ff4e42";
    console.log(
      `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`,
      `color: ${color}; font-weight: bold;`
    );
  }
  
  // Call optional reporter
  reportCallback?.(metric);
};

// Observe Largest Contentful Paint (LCP)
const observeLCP = () => {
  if (!("PerformanceObserver" in window)) return;
  
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      
      reportMetric({
        name: "LCP",
        value: lastEntry.startTime,
        rating: getRating("LCP", lastEntry.startTime),
        delta: lastEntry.startTime,
        id: `lcp-${Date.now()}`,
      });
    });
    
    observer.observe({ type: "largest-contentful-paint", buffered: true });
  } catch (e) {
    // LCP not supported
  }
};

// Observe First Input Delay (FID) / Interaction to Next Paint (INP)
const observeInteraction = () => {
  if (!("PerformanceObserver" in window)) return;
  
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as (PerformanceEntry & { processingStart: number; startTime: number })[];
      
      entries.forEach((entry) => {
        const delay = entry.processingStart - entry.startTime;
        
        reportMetric({
          name: "INP",
          value: delay,
          rating: getRating("INP", delay),
          delta: delay,
          id: `inp-${Date.now()}`,
        });
      });
    });
    
    observer.observe({ type: "first-input", buffered: true });
  } catch (e) {
    // FID/INP not supported
  }
};

// Observe Cumulative Layout Shift (CLS)
const observeCLS = () => {
  if (!("PerformanceObserver" in window)) return;
  
  let clsValue = 0;
  let clsEntries: PerformanceEntry[] = [];
  
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as (PerformanceEntry & { hadRecentInput: boolean; value: number })[];
      
      entries.forEach((entry) => {
        // Only count if there was no recent user input
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          clsEntries.push(entry);
        }
      });
      
      reportMetric({
        name: "CLS",
        value: clsValue,
        rating: getRating("CLS", clsValue),
        delta: clsValue,
        id: `cls-${Date.now()}`,
      });
    });
    
    observer.observe({ type: "layout-shift", buffered: true });
  } catch (e) {
    // CLS not supported
  }
};

// Observe First Contentful Paint (FCP)
const observeFCP = () => {
  if (!("PerformanceObserver" in window)) return;
  
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fcpEntry = entries.find((e) => e.name === "first-contentful-paint") as PerformanceEntry & { startTime: number };
      
      if (fcpEntry) {
        reportMetric({
          name: "FCP",
          value: fcpEntry.startTime,
          rating: getRating("FCP", fcpEntry.startTime),
          delta: fcpEntry.startTime,
          id: `fcp-${Date.now()}`,
        });
      }
    });
    
    observer.observe({ type: "paint", buffered: true });
  } catch (e) {
    // FCP not supported
  }
};

// Measure Time to First Byte (TTFB)
const measureTTFB = () => {
  if (!("performance" in window) || !performance.getEntriesByType) return;
  
  const [navigationEntry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  
  if (navigationEntry) {
    const ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
    
    reportMetric({
      name: "TTFB",
      value: ttfb,
      rating: getRating("TTFB", ttfb),
      delta: ttfb,
      id: `ttfb-${Date.now()}`,
    });
  }
};

// Measure page load time
const measurePageLoad = () => {
  if (!("performance" in window)) return;
  
  window.addEventListener("load", () => {
    setTimeout(() => {
      const [navigationEntry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      
      if (navigationEntry) {
        const loadTime = navigationEntry.loadEventEnd - navigationEntry.startTime;
        
        if (loadTime > 0) {
          console.log(
            `%c[Web Vitals] Page Load Time: ${loadTime.toFixed(2)}ms`,
            "color: #6366f1; font-weight: bold;"
          );
        }
      }
    }, 0);
  });
};

// Initialize all observers
let initialized = false;

export function initWebVitals() {
  if (initialized) return;
  initialized = true;
  
  observeLCP();
  observeInteraction();
  observeCLS();
  observeFCP();
  measureTTFB();
  measurePageLoad();
}

// Hook for React components
export function useWebVitals(onReport?: ReportCallback) {
  useEffect(() => {
    if (onReport) {
      setWebVitalsReporter(onReport);
    }
    
    initWebVitals();
    
    return () => {
      if (onReport) {
        reportCallback = null;
      }
    };
  }, [onReport]);
  
  return getWebVitals;
}
