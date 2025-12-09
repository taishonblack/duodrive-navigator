import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScoreReportRequest {
  recipientEmail: string;
  vehicleInfo: string;
  overallScore: number;
  recommendation: string;
  metrics: {
    trueMarketPrice: number;
    dealPriceGap: number;
    dealPriceGapPercent: number;
    customerMaxSafePrice: number;
    customerFitGap: number;
    customerFitGapPercent: number;
    monthlyPayment: number;
    totalCost: number;
  };
  pillars: {
    depreciation: { score: number; details: string };
    reliability: { score: number; details: string };
    safety: { score: number; details: string };
    dealHealth: { score: number; details: string };
    affordability: { score: number; details: string };
  };
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
};

const getScoreLabel = (score: number): string => {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Caution";
  return "Risky";
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-score-report function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ScoreReportRequest = await req.json();
    console.log("Sending score report to:", data.recipientEmail);

    const scoreColor = getScoreColor(data.overallScore);
    const scoreLabel = getScoreLabel(data.overallScore);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">DuoDrive Score Report</h1>
            <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px;">${data.vehicleInfo}</p>
          </div>

          <!-- Score -->
          <div style="background: white; padding: 30px; text-align: center; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
            <div style="display: inline-block; width: 100px; height: 100px; border-radius: 50%; background-color: ${scoreColor}; line-height: 100px; text-align: center;">
              <span style="color: white; font-size: 36px; font-weight: bold;">${data.overallScore}</span>
            </div>
            <p style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 15px 0 5px 0;">${scoreLabel}</p>
          </div>

          <!-- V3 Metrics -->
          <div style="background: white; padding: 20px 30px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
            <h2 style="color: #1e293b; font-size: 16px; margin: 0 0 15px 0;">Market & Budget Analysis</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; background: #f8fafc; border-radius: 8px;">
                  <p style="color: #64748b; font-size: 12px; margin: 0;">True Market Price</p>
                  <p style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 5px 0 0 0;">$${data.metrics.trueMarketPrice.toLocaleString()}</p>
                </td>
                <td style="width: 10px;"></td>
                <td style="padding: 10px; background: #f8fafc; border-radius: 8px;">
                  <p style="color: #64748b; font-size: 12px; margin: 0;">Deal Price Gap</p>
                  <p style="color: ${data.metrics.dealPriceGapPercent <= 5 ? '#22c55e' : '#ef4444'}; font-size: 18px; font-weight: 600; margin: 5px 0 0 0;">${data.metrics.dealPriceGap >= 0 ? '+' : ''}$${data.metrics.dealPriceGap.toLocaleString()} (${data.metrics.dealPriceGapPercent}%)</p>
                </td>
              </tr>
              <tr><td colspan="3" style="height: 10px;"></td></tr>
              <tr>
                <td style="padding: 10px; background: #f8fafc; border-radius: 8px;">
                  <p style="color: #64748b; font-size: 12px; margin: 0;">Max Safe Price</p>
                  <p style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 5px 0 0 0;">$${data.metrics.customerMaxSafePrice.toLocaleString()}</p>
                </td>
                <td style="width: 10px;"></td>
                <td style="padding: 10px; background: #f8fafc; border-radius: 8px;">
                  <p style="color: #64748b; font-size: 12px; margin: 0;">Budget Fit Gap</p>
                  <p style="color: ${data.metrics.customerFitGapPercent <= 10 ? '#22c55e' : '#ef4444'}; font-size: 18px; font-weight: 600; margin: 5px 0 0 0;">${data.metrics.customerFitGap >= 0 ? '+' : ''}$${data.metrics.customerFitGap.toLocaleString()} (${data.metrics.customerFitGapPercent}%)</p>
                </td>
              </tr>
            </table>
          </div>

          <!-- Pillars -->
          <div style="background: white; padding: 20px 30px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
            <h2 style="color: #1e293b; font-size: 16px; margin: 0 0 15px 0;">Score Breakdown</h2>
            ${Object.entries(data.pillars).map(([name, pillar]) => `
              <div style="display: flex; align-items: center; margin-bottom: 10px; padding: 10px; background: #f8fafc; border-radius: 8px;">
                <div style="width: 40px; height: 40px; border-radius: 8px; background-color: ${getScoreColor(pillar.score)}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${pillar.score}</div>
                <div style="margin-left: 12px; flex: 1;">
                  <p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0; text-transform: capitalize;">${name.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">${pillar.details}</p>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Financials -->
          <div style="background: white; padding: 20px 30px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
            <h2 style="color: #1e293b; font-size: 16px; margin: 0 0 15px 0;">Financial Summary</h2>
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Monthly Payment</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">$${data.metrics.monthlyPayment.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Total Cost</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">$${data.metrics.totalCost.toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <!-- Recommendation -->
          <div style="background: #fef3c7; padding: 20px 30px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
            <h2 style="color: #92400e; font-size: 14px; margin: 0 0 10px 0;">AI Recommendation</h2>
            <p style="color: #78350f; font-size: 14px; margin: 0; line-height: 1.5;">${data.recommendation}</p>
          </div>

          <!-- Footer -->
          <div style="background: #1e293b; padding: 20px 30px; border-radius: 0 0 16px 16px; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">DuoDrive - Your trusted car buying advisor</p>
            <p style="color: #64748b; font-size: 10px; margin: 10px 0 0 0;">This report is for informational purposes only.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "DuoDrive <onboarding@resend.dev>",
      to: [data.recipientEmail],
      subject: `DuoDrive Score Report: ${data.vehicleInfo} - Score ${data.overallScore}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
