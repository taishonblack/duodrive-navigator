import jsPDF from "jspdf";
import { ScoreResult } from "./duodriveScore";

interface DealData {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: string;
  askingPrice?: string;
  negotiatedPrice?: string;
  apr?: string;
  term?: string;
  downPayment?: string;
  tradeIn?: string;
  monthlyIncome?: string;
}

const getScoreLabel = (score: number): string => {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Caution";
  return "Risky";
};

const getScoreColor = (score: number): [number, number, number] => {
  if (score >= 80) return [34, 197, 94]; // green
  if (score >= 60) return [234, 179, 8]; // yellow
  if (score >= 40) return [249, 115, 22]; // orange
  return [239, 68, 68]; // red
};

const getDPGColor = (percent: number): [number, number, number] => {
  if (percent <= 0) return [34, 197, 94];
  if (percent <= 5) return [234, 179, 8];
  if (percent <= 10) return [249, 115, 22];
  return [239, 68, 68];
};

const getCFGColor = (percent: number): [number, number, number] => {
  if (percent <= 0) return [34, 197, 94];
  if (percent <= 10) return [234, 179, 8];
  if (percent <= 25) return [249, 115, 22];
  return [239, 68, 68];
};

export const generateScoreReport = (scoreResult: ScoreResult, dealData: DealData): void => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = 20;

  // Header
  pdf.setFillColor(30, 41, 59); // slate-800
  pdf.rect(0, 0, pageWidth, 45, "F");
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  pdf.text("DuoDrive Score Report", 20, 25);
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 35);

  y = 60;

  // Vehicle Info Box
  pdf.setFillColor(248, 250, 252); // slate-50
  pdf.roundedRect(15, y - 5, pageWidth - 30, 25, 3, 3, "F");
  
  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  const vehicleTitle = `${dealData.year || ""} ${dealData.make || ""} ${dealData.model || ""} ${dealData.trim || ""}`.trim() || "Vehicle Details";
  pdf.text(vehicleTitle, 20, y + 5);
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 116, 139);
  const mileageText = dealData.mileage ? `${parseInt(dealData.mileage).toLocaleString()} miles` : "";
  pdf.text(mileageText, 20, y + 14);

  y += 35;

  // Main Score Circle
  const scoreColor = getScoreColor(scoreResult.overall);
  pdf.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  pdf.circle(pageWidth / 2, y + 25, 25, "F");
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  pdf.text(scoreResult.overall.toString(), pageWidth / 2, y + 30, { align: "center" });
  
  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(12);
  pdf.text(`Overall Score: ${getScoreLabel(scoreResult.overall)}`, pageWidth / 2, y + 60, { align: "center" });

  y += 80;

  // V3 Metrics Section
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 41, 59);
  pdf.text("Market & Budget Analysis", 20, y);
  y += 10;

  // Metrics Grid
  const metrics = [
    {
      label: "True Market Price (TMP)",
      value: `$${scoreResult.trueMarketPrice.toLocaleString()}`,
      color: getDPGColor(scoreResult.dealPriceGapPercent),
    },
    {
      label: "Deal Price Gap (DPG)",
      value: `${scoreResult.dealPriceGap >= 0 ? "+" : ""}$${scoreResult.dealPriceGap.toLocaleString()} (${scoreResult.dealPriceGapPercent}%)`,
      color: getDPGColor(scoreResult.dealPriceGapPercent),
    },
    {
      label: "Max Safe Price (CMSP)",
      value: `$${scoreResult.customerMaxSafePrice.toLocaleString()}`,
      color: getCFGColor(scoreResult.customerFitGapPercent),
    },
    {
      label: "Budget Fit Gap (CFG)",
      value: `${scoreResult.customerFitGap >= 0 ? "+" : ""}$${scoreResult.customerFitGap.toLocaleString()} (${scoreResult.customerFitGapPercent}%)`,
      color: getCFGColor(scoreResult.customerFitGapPercent),
    },
  ];

  const boxWidth = (pageWidth - 50) / 2;
  metrics.forEach((metric, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 20 + col * (boxWidth + 10);
    const boxY = y + row * 30;

    pdf.setFillColor(metric.color[0], metric.color[1], metric.color[2]);
    pdf.roundedRect(x, boxY, 4, 20, 1, 1, "F");
    
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(x + 4, boxY, boxWidth - 4, 20, 0, 0, "F");

    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(metric.label, x + 10, boxY + 8);

    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(metric.value, x + 10, boxY + 16);
  });

  y += 75;

  // Pillar Scores
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 41, 59);
  pdf.text("Score Breakdown by Pillar", 20, y);
  y += 10;

  const pillars = [
    { name: "Depreciation", score: scoreResult.pillars.depreciation.score, details: scoreResult.pillars.depreciation.details },
    { name: "Reliability", score: scoreResult.pillars.reliability.score, details: scoreResult.pillars.reliability.details },
    { name: "Safety", score: scoreResult.pillars.safety.score, details: scoreResult.pillars.safety.details },
    { name: "Deal Health", score: scoreResult.pillars.dealHealth.score, details: scoreResult.pillars.dealHealth.details },
    { name: "Affordability", score: scoreResult.pillars.affordability.score, details: scoreResult.pillars.affordability.details },
  ];

  pillars.forEach((pillar, i) => {
    const pillarY = y + i * 18;
    const color = getScoreColor(pillar.score);

    // Score badge
    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.roundedRect(20, pillarY, 24, 12, 2, 2, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(pillar.score.toString(), 32, pillarY + 8, { align: "center" });

    // Pillar name
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(11);
    pdf.text(pillar.name, 50, pillarY + 8);

    // Details (truncated)
    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    const truncatedDetails = pillar.details.length > 50 ? pillar.details.substring(0, 50) + "..." : pillar.details;
    pdf.text(truncatedDetails, 110, pillarY + 8);
  });

  y += 100;

  // Financial Summary
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 41, 59);
  pdf.text("Financial Summary", 20, y);
  y += 10;

  const financials = [
    ["Monthly Payment", `$${scoreResult.monthlyPayment.toLocaleString()}`],
    ["Loan Amount", `$${scoreResult.loanAmount.toLocaleString()}`],
    ["Total Interest", `$${scoreResult.totalInterest.toLocaleString()}`],
    ["Total Cost", `$${scoreResult.totalCost.toLocaleString()}`],
    ["Payment Burden", `${scoreResult.paymentBurdenPercent}% of income`],
    ["Total Monthly Cost", `$${scoreResult.totalMonthlyCost.toLocaleString()}`],
  ];

  financials.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 20 + col * 90;
    const finY = y + row * 12;

    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(item[0], x, finY);

    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(item[1], x, finY + 6);
  });

  y += 50;

  // AI Recommendation
  pdf.setFillColor(254, 243, 199); // amber-100
  pdf.roundedRect(15, y - 5, pageWidth - 30, 40, 3, 3, "F");

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(146, 64, 14); // amber-800
  pdf.text("AI Recommendation", 20, y + 5);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(120, 53, 15);
  
  // Word wrap recommendation
  const maxWidth = pageWidth - 50;
  const splitText = pdf.splitTextToSize(scoreResult.recommendation, maxWidth);
  pdf.text(splitText.slice(0, 3), 20, y + 15);

  // Footer
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(8);
  pdf.text("DuoDrive - Your trusted car buying advisor", pageWidth / 2, 285, { align: "center" });
  pdf.text("This report is for informational purposes only.", pageWidth / 2, 290, { align: "center" });

  // Save
  const fileName = `DuoDrive_Score_${dealData.year || ""}_${dealData.make || ""}_${dealData.model || ""}_${new Date().toISOString().split("T")[0]}.pdf`.replace(/\s+/g, "_");
  pdf.save(fileName);
};
