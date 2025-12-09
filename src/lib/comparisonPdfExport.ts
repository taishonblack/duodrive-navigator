import jsPDF from "jspdf";
import { ScoreResult } from "./duodriveScore";

interface DealForComparison {
  id: string;
  name: string;
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: string;
  askingPrice?: string;
  score_result?: ScoreResult | null;
}

const getScoreColor = (score: number): [number, number, number] => {
  if (score >= 80) return [34, 197, 94];
  if (score >= 60) return [234, 179, 8];
  if (score >= 40) return [249, 115, 22];
  return [239, 68, 68];
};

export const generateComparisonReport = (deals: DealForComparison[]): void => {
  const pdf = new jsPDF({ orientation: "landscape" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = 20;

  // Header
  pdf.setFillColor(30, 41, 59);
  pdf.rect(0, 0, pageWidth, 35, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  pdf.text("DuoDrive Deal Comparison", 20, 22);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Generated: ${new Date().toLocaleDateString()} | Comparing ${deals.length} deals`, 20, 30);

  y = 50;

  // Calculate column widths
  const labelWidth = 55;
  const dealCount = deals.length;
  const availableWidth = pageWidth - labelWidth - 30;
  const colWidth = Math.min(availableWidth / dealCount, 60);
  const startX = labelWidth + 20;

  // Deal Headers with Score Circles
  deals.forEach((deal, i) => {
    const x = startX + i * colWidth;
    const scoreResult = deal.score_result;
    const score = scoreResult?.overall || 0;
    const color = getScoreColor(score);

    // Score circle
    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.circle(x + colWidth / 2, y + 8, 12, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text(score.toString(), x + colWidth / 2, y + 12, { align: "center" });

    // Vehicle name
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(9);
    const vehicleName = `${deal.year || ""} ${deal.make || ""}`.trim() || deal.name;
    const model = deal.model || "";
    pdf.text(vehicleName, x + colWidth / 2, y + 28, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.text(model, x + colWidth / 2, y + 35, { align: "center" });
  });

  y += 45;

  // Comparison rows
  const rows = [
    { label: "Overall Score", getValue: (d: DealForComparison) => d.score_result?.overall?.toString() || "-", highlight: true },
    { label: "True Market Price", getValue: (d: DealForComparison) => d.score_result ? `$${d.score_result.trueMarketPrice.toLocaleString()}` : "-" },
    { label: "Deal Price Gap", getValue: (d: DealForComparison) => d.score_result ? `${d.score_result.dealPriceGap >= 0 ? "+" : ""}$${d.score_result.dealPriceGap.toLocaleString()}` : "-", colorByValue: "dpg" },
    { label: "Max Safe Price", getValue: (d: DealForComparison) => d.score_result ? `$${d.score_result.customerMaxSafePrice.toLocaleString()}` : "-" },
    { label: "Budget Fit Gap", getValue: (d: DealForComparison) => d.score_result ? `${d.score_result.customerFitGap >= 0 ? "+" : ""}$${d.score_result.customerFitGap.toLocaleString()}` : "-", colorByValue: "cfg" },
    { label: "Monthly Payment", getValue: (d: DealForComparison) => d.score_result ? `$${d.score_result.monthlyPayment.toLocaleString()}` : "-" },
    { label: "Total Cost", getValue: (d: DealForComparison) => d.score_result ? `$${d.score_result.totalCost.toLocaleString()}` : "-" },
    { label: "", getValue: () => "", isSpacer: true },
    { label: "Depreciation", getValue: (d: DealForComparison) => d.score_result?.pillars.depreciation.score.toString() || "-", isPillar: true },
    { label: "Reliability", getValue: (d: DealForComparison) => d.score_result?.pillars.reliability.score.toString() || "-", isPillar: true },
    { label: "Safety", getValue: (d: DealForComparison) => d.score_result?.pillars.safety.score.toString() || "-", isPillar: true },
    { label: "Deal Health", getValue: (d: DealForComparison) => d.score_result?.pillars.dealHealth.score.toString() || "-", isPillar: true },
    { label: "Affordability", getValue: (d: DealForComparison) => d.score_result?.pillars.affordability.score.toString() || "-", isPillar: true },
  ];

  // Find best values for highlighting
  const bestValues: { [key: string]: number } = {};
  ["Overall Score", "Monthly Payment", "Total Cost", "Deal Price Gap", "Budget Fit Gap"].forEach(label => {
    const values = deals.map(d => {
      if (label === "Overall Score") return d.score_result?.overall || 0;
      if (label === "Monthly Payment") return d.score_result?.monthlyPayment || Infinity;
      if (label === "Total Cost") return d.score_result?.totalCost || Infinity;
      if (label === "Deal Price Gap") return d.score_result?.dealPriceGap || Infinity;
      if (label === "Budget Fit Gap") return d.score_result?.customerFitGap || Infinity;
      return 0;
    });
    if (label === "Overall Score") {
      bestValues[label] = Math.max(...values);
    } else {
      bestValues[label] = Math.min(...values);
    }
  });

  rows.forEach((row, rowIndex) => {
    if (row.isSpacer) {
      y += 5;
      return;
    }

    const rowY = y + rowIndex * 12;
    const isEven = rowIndex % 2 === 0;

    // Row background
    if (!row.isSpacer) {
      pdf.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
      pdf.rect(15, rowY - 4, pageWidth - 30, 11, "F");
    }

    // Row label
    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", row.highlight ? "bold" : "normal");
    pdf.text(row.label, 20, rowY + 4);

    // Values for each deal
    deals.forEach((deal, i) => {
      const x = startX + i * colWidth;
      const value = row.getValue(deal);
      const numValue = parseFloat(value.replace(/[^0-9.-]/g, "")) || 0;

      // Check if this is the best value
      let isBest = false;
      if (row.label === "Overall Score" && numValue === bestValues["Overall Score"] && numValue > 0) isBest = true;
      if (row.label === "Monthly Payment" && numValue === bestValues["Monthly Payment"] && numValue < Infinity) isBest = true;
      if (row.label === "Total Cost" && numValue === bestValues["Total Cost"] && numValue < Infinity) isBest = true;

      // Set color
      if (row.isPillar && value !== "-") {
        const score = parseInt(value);
        const color = getScoreColor(score);
        pdf.setTextColor(color[0], color[1], color[2]);
      } else if (isBest) {
        pdf.setTextColor(34, 197, 94);
      } else if (row.colorByValue === "dpg" && deal.score_result) {
        const dpg = deal.score_result.dealPriceGapPercent;
        if (dpg <= 0) pdf.setTextColor(34, 197, 94);
        else if (dpg <= 5) pdf.setTextColor(234, 179, 8);
        else if (dpg <= 10) pdf.setTextColor(249, 115, 22);
        else pdf.setTextColor(239, 68, 68);
      } else if (row.colorByValue === "cfg" && deal.score_result) {
        const cfg = deal.score_result.customerFitGapPercent;
        if (cfg <= 0) pdf.setTextColor(34, 197, 94);
        else if (cfg <= 10) pdf.setTextColor(234, 179, 8);
        else if (cfg <= 25) pdf.setTextColor(249, 115, 22);
        else pdf.setTextColor(239, 68, 68);
      } else {
        pdf.setTextColor(30, 41, 59);
      }

      pdf.setFontSize(9);
      pdf.setFont("helvetica", isBest || row.highlight ? "bold" : "normal");
      pdf.text(value, x + colWidth / 2, rowY + 4, { align: "center" });
    });
  });

  y += rows.length * 12 + 15;

  // Legend
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(15, y, pageWidth - 30, 20, 3, 3, "F");

  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text("Legend:", 20, y + 8);

  pdf.setTextColor(34, 197, 94);
  pdf.text("Green = Best value / Score 80+", 55, y + 8);

  pdf.setTextColor(234, 179, 8);
  pdf.text("Yellow = Score 60-79", 130, y + 8);

  pdf.setTextColor(249, 115, 22);
  pdf.text("Orange = Score 40-59", 185, y + 8);

  pdf.setTextColor(239, 68, 68);
  pdf.text("Red = Score below 40", 240, y + 8);

  // Footer
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(8);
  pdf.text("DuoDrive - Your trusted car buying advisor", pageWidth / 2, pageHeight - 10, { align: "center" });

  // Save
  const fileName = `DuoDrive_Comparison_${deals.length}_Deals_${new Date().toISOString().split("T")[0]}.pdf`;
  pdf.save(fileName);
};
