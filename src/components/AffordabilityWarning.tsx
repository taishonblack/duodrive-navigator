import { useState } from "react";
import { AlertTriangle, Search, BarChart3, Car, ChevronDown, ChevronUp, ShieldAlert, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AffordabilityResult,
  AffordabilityStatus,
  getAffordabilityBgColor,
  getAffordabilityColor,
  getAffordabilityLabel,
} from "@/lib/affordabilityRules";

interface AffordabilityWarningProps {
  result: AffordabilityResult;
  onAcknowledge?: () => void;
  isAcknowledged?: boolean;
}

export function AffordabilityWarning({ result, onAcknowledge, isAcknowledged = false }: AffordabilityWarningProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { overallStatus, primaryMessage, detailedExplanation, suggestedActions, ruleViolations, cmsp, cfg } = result;
  
  // Don't show warning if budget fits
  if (overallStatus === 'fits_budget') {
    return (
      <Card className={`border-2 ${getAffordabilityBgColor(overallStatus)}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className={`font-semibold ${getAffordabilityColor(overallStatus)}`}>
                {getAffordabilityLabel(overallStatus)}
              </h3>
              <p className="text-sm text-muted-foreground">
                Max safe price: ${cmsp.toLocaleString()} • You're ${cfg > 0 ? `$${cfg.toLocaleString()} under` : 'at'} budget
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const isBlocking = overallStatus === 'outside_budget' || overallStatus === 'blocked';
  const iconColor = overallStatus === 'stretch_warning' 
    ? 'text-yellow-600 dark:text-yellow-400' 
    : 'text-red-600 dark:text-red-400';
  const iconBg = overallStatus === 'stretch_warning' 
    ? 'bg-yellow-100 dark:bg-yellow-900/50' 
    : 'bg-red-100 dark:bg-red-900/50';

  return (
    <Card className={`border-2 ${getAffordabilityBgColor(overallStatus)} transition-all duration-300`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
            {isBlocking ? (
              <ShieldAlert className={`h-6 w-6 ${iconColor}`} />
            ) : (
              <AlertTriangle className={`h-6 w-6 ${iconColor}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className={`text-lg ${getAffordabilityColor(overallStatus)}`}>
              {getAffordabilityLabel(overallStatus)}
            </CardTitle>
            <p className="mt-1 text-sm font-medium text-foreground">
              {primaryMessage}
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-background/50">
            <p className="text-xs text-muted-foreground">Max Safe Price</p>
            <p className="text-lg font-bold text-foreground">${cmsp.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-background/50">
            <p className="text-xs text-muted-foreground">Over Budget By</p>
            <p className={`text-lg font-bold ${cfg < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {cfg < 0 ? `$${Math.abs(cfg).toLocaleString()}` : 'Within budget'}
            </p>
          </div>
        </div>

        {/* Rule Violations */}
        {ruleViolations.length > 0 && (
          <div className="space-y-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {ruleViolations.length} affordability concern{ruleViolations.length > 1 ? 's' : ''} detected
            </button>
            
            {isExpanded && (
              <div className="space-y-2 animate-fade-in">
                {ruleViolations.map((violation, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border ${
                      violation.severity === 'block' || violation.severity === 'danger'
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                        : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${
                        violation.severity === 'block' || violation.severity === 'danger'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-yellow-600 dark:text-yellow-400'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Rule {violation.rule}: {violation.ruleName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {violation.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detailed Explanation */}
        <div className="p-4 rounded-lg bg-background/50 border border-border">
          <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
            {detailedExplanation}
          </p>
        </div>

        {/* Suggested Actions */}
        {suggestedActions.length > 0 && (
          <div className="space-y-2">
            {suggestedActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3 text-left"
                onClick={() => {
                  // Future: implement action handlers
                  console.log('Action clicked:', action.label);
                }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  {action.icon === 'search' && <Search className="h-4 w-4 text-primary" />}
                  {action.icon === 'chart' && <BarChart3 className="h-4 w-4 text-primary" />}
                  {action.icon === 'car' && <Car className="h-4 w-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </Button>
            ))}
          </div>
        )}

        {/* Acknowledge Button for Blocking States */}
        {isBlocking && !isAcknowledged && (
          <div className="pt-2 border-t border-border">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={onAcknowledge}
            >
              <Lock className="h-4 w-4" />
              I understand the risk — show me options anyway
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Negotiation scripts are locked until you acknowledge this warning
            </p>
          </div>
        )}
        
        {isBlocking && isAcknowledged && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span>Warning acknowledged — proceed with caution</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
