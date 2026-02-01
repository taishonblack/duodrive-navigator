import jsPDF from "jspdf";

interface ReceiptData {
  paymentIntentId: string;
  dealName: string;
  unlockedAt: string;
  amount: number;
}

export const generateDealReceipt = (data: ReceiptData): void => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = 20;

  // Header
  pdf.setFillColor(30, 41, 59); // slate-800
  pdf.rect(0, 0, pageWidth, 50, "F");
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  pdf.text("DuoDrive", 20, 28);
  
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.text("Payment Receipt", 20, 40);

  y = 70;

  // Receipt Info Box
  pdf.setFillColor(248, 250, 252); // slate-50
  pdf.roundedRect(15, y - 10, pageWidth - 30, 35, 3, 3, "F");
  
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(10);
  pdf.text("Receipt Number", 25, y);
  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text(data.paymentIntentId, 25, y + 8);

  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text("Date", 130, y);
  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text(new Date(data.unlockedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }), 130, y + 8);

  y += 50;

  // Line Items Header
  pdf.setFillColor(241, 245, 249); // slate-100
  pdf.rect(15, y, pageWidth - 30, 12, "F");
  
  pdf.setTextColor(71, 85, 105); // slate-600
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("Description", 25, y + 8);
  pdf.text("Amount", pageWidth - 45, y + 8, { align: "right" });

  y += 20;

  // Line Item
  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text("Deal Analysis Unlock", 25, y);
  
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(9);
  pdf.text(data.dealName, 25, y + 8);

  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text(`$${data.amount.toFixed(2)}`, pageWidth - 25, y + 4, { align: "right" });

  y += 25;

  // Divider
  pdf.setDrawColor(226, 232, 240);
  pdf.line(15, y, pageWidth - 15, y);

  y += 15;

  // Total
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text("Total Paid", 25, y);
  
  pdf.setTextColor(34, 197, 94); // green-500
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(`$${data.amount.toFixed(2)}`, pageWidth - 25, y, { align: "right" });

  y += 30;

  // Payment Status Badge
  pdf.setFillColor(220, 252, 231); // green-100
  pdf.roundedRect(15, y, 60, 20, 3, 3, "F");
  pdf.setTextColor(22, 101, 52); // green-800
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("✓ Payment Successful", 22, y + 13);

  y += 45;

  // Thank You Message
  pdf.setFillColor(254, 249, 195); // yellow-100
  pdf.roundedRect(15, y - 5, pageWidth - 30, 35, 3, 3, "F");
  
  pdf.setTextColor(133, 77, 14); // yellow-800
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Thank you for your purchase!", 25, y + 8);
  
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("Your deal analysis has been unlocked. You now have full access to", 25, y + 18);
  pdf.text("Fee Breakdown and Negotiation Scripts for this deal.", 25, y + 25);

  // Footer
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(8);
  pdf.text("DuoDrive - Your trusted car buying advisor", pageWidth / 2, 270, { align: "center" });
  pdf.text("support@duodrive.com", pageWidth / 2, 277, { align: "center" });
  pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 284, { align: "center" });

  // Save
  const fileName = `DuoDrive_Receipt_${data.paymentIntentId.slice(0, 15)}.pdf`;
  pdf.save(fileName);
};
