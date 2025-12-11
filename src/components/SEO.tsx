import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  noIndex?: boolean;
  structuredData?: object | object[];
}

const defaultTitle = "DuoDrive - Car Buying Simplified";
const defaultDescription = "DuoDrive helps you understand if a car deal is safe, fair, affordable — and right for your budget. Get instant analysis with the DuoDrive Score.";
const defaultKeywords = "car buying, car deal analyzer, DuoDrive Score, car affordability, vehicle purchase, car buying coach";
const siteUrl = "https://duodrive.app";
const defaultImage = "https://lovable.dev/opengraph-image-p98pqg.png";

export function SEO({
  title,
  description = defaultDescription,
  keywords = defaultKeywords,
  canonical,
  ogType = "website",
  ogImage = defaultImage,
  noIndex = false,
  structuredData,
}: SEOProps) {
  const pageTitle = title ? `${title} | DuoDrive` : defaultTitle;

  // Handle single object or array of structured data
  const structuredDataArray = structuredData 
    ? Array.isArray(structuredData) ? structuredData : [structuredData]
    : [];

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {canonical && <link rel="canonical" href={`${siteUrl}${canonical}`} />}
      
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Open Graph */}
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      {canonical && <meta property="og:url" content={`${siteUrl}${canonical}`} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data (JSON-LD) */}
      {structuredDataArray.map((data, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
}

// Common structured data helpers
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "DuoDrive",
  "url": "https://duodrive.app",
  "logo": "https://duodrive.app/favicon.ico",
  "description": "DuoDrive helps car buyers understand if a deal is safe, fair, and affordable.",
  "sameAs": []
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "DuoDrive",
  "url": "https://duodrive.app",
  "description": "Car Buying Simplified - Get instant analysis with the DuoDrive Score",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://duodrive.app/deal-room",
    "query-input": "required name=search_term_string"
  }
};
