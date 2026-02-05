 /**
  * Feature flags for DuoDrive
  * Flip these to enable/disable features across the app
  */
 export const FEATURES = {
   /**
    * Premium deal analysis ($9.99 paywall)
    * When false: Premium UI is hidden, shows "Coming Soon" messaging
    * When true: Full paywall and premium features active
    */
   premiumEnabled: false,
   
   /**
    * Human coaching escalation ($49)
    * Legacy feature - currently disabled
    */
   coachingEnabled: false,
 } as const;
 
 export type FeatureFlags = typeof FEATURES;