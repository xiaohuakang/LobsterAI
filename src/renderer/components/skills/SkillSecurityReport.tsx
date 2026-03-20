import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldExclamationIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { i18nService } from '../../services/i18n';

interface SecurityFinding {
  dimension: string;
  severity: string;
  ruleId: string;
  file: string;
  line?: number;
  matchedPattern: string;
  description: string;
}

interface SkillSecurityReport {
  skillName: string;
  riskLevel: string;
  riskScore: number;
  findings: SecurityFinding[];
  dimensionSummary: Record<string, { count: number; maxSeverity: string }>;
  scanDurationMs: number;
}

interface SkillSecurityReportProps {
  report: SkillSecurityReport;
  onAction: (action: 'install' | 'installDisabled' | 'cancel') => void;
  isLoading?: boolean;
}

const DIMENSION_LABELS: Record<string, string> = {
  file_access: 'securityDimFileAccess',
  dangerous_command: 'securityDimDangerousCmd',
  network: 'securityDimNetwork',
  process: 'securityDimProcess',
  screen_input: 'securityDimScreenInput',
  payment: 'securityDimPayment',
  prompt_injection: 'securityDimPromptInjection',
  web_content: 'securityDimWebContent',
};

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500/20' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/20' },
  critical: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20' },
};

const SEVERITY_DOTS: Record<string, string> = {
  info: 'bg-gray-400',
  warning: 'bg-yellow-500',
  danger: 'bg-orange-500',
  critical: 'bg-red-500',
};

const SkillSecurityReport: React.FC<SkillSecurityReportProps> = ({
  report,
  onAction,
  isLoading,
}) => {
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(new Set());
  const riskColors = RISK_COLORS[report.riskLevel] || RISK_COLORS.medium;

  const toggleDimension = (dim: string) => {
    setExpandedDimensions(prev => {
      const next = new Set(prev);
      if (next.has(dim)) {
        next.delete(dim);
      } else {
        next.add(dim);
      }
      return next;
    });
  };

  // Group findings by dimension
  const findingsByDimension = new Map<string, SecurityFinding[]>();
  for (const finding of report.findings) {
    const existing = findingsByDimension.get(finding.dimension) || [];
    existing.push(finding);
    findingsByDimension.set(finding.dimension, existing);
  }

  const totalFindings = report.findings.length;
  const isCritical = report.riskLevel === 'critical';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => onAction('cancel')}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-2xl dark:bg-claude-darkBg bg-white shadow-xl border dark:border-claude-darkBorder border-claude-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-claude-darkBorder border-claude-border">
          <div className="flex items-center gap-2.5">
            <ShieldExclamationIcon className={`h-5 w-5 ${riskColors.text}`} />
            <h3 className="text-base font-semibold dark:text-claude-darkText text-claude-text">
              {i18nService.t('securityScanTitle')}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onAction('cancel')}
            className="p-1 rounded-lg hover:bg-claude-hover dark:hover:bg-claude-darkHover transition-colors"
          >
            <XMarkIcon className="h-4 w-4 dark:text-claude-darkTextSecondary text-claude-textSecondary" />
          </button>
        </div>

        {/* Risk badge and summary - outside scroll area */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${riskColors.bg} ${riskColors.text} border ${riskColors.border}`}>
              {i18nService.t(`securityRisk_${report.riskLevel}`)}
            </span>
            <span className="text-sm dark:text-claude-darkTextSecondary text-claude-textSecondary">
              &quot;{report.skillName}&quot;
            </span>
          </div>
          <p className="text-sm dark:text-claude-darkTextSecondary text-claude-textSecondary">
            {i18nService.t('securityIssuesFound').replace('{count}', String(totalFindings))}
          </p>
        </div>

        {/* Findings - scrollable area */}
        <div className="px-5 pb-4 max-h-[50vh] overflow-y-auto">
          <div className="space-y-1.5">
            {Array.from(findingsByDimension.entries()).map(([dimension, findings]) => {
              const isExpanded = expandedDimensions.has(dimension);
              const summary = report.dimensionSummary[dimension];
              const dimLabel = DIMENSION_LABELS[dimension];

              return (
                <div key={dimension} className="rounded-xl dark:bg-claude-darkBgSecondary bg-claude-bgSecondary overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleDimension(dimension)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-claude-hover dark:hover:bg-claude-darkHover transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDownIcon className="h-3.5 w-3.5 dark:text-claude-darkTextSecondary text-claude-textSecondary" />
                      ) : (
                        <ChevronRightIcon className="h-3.5 w-3.5 dark:text-claude-darkTextSecondary text-claude-textSecondary" />
                      )}
                      <span className={`w-2 h-2 rounded-full ${SEVERITY_DOTS[summary?.maxSeverity || 'warning']}`} />
                      <span className="text-sm font-medium dark:text-claude-darkText text-claude-text">
                        {dimLabel ? i18nService.t(dimLabel) : dimension}
                      </span>
                    </div>
                    <span className="text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary">
                      {findings.length}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-3.5 pb-3 space-y-2">
                      {findings.map((finding, idx) => (
                        <div key={`${finding.ruleId}-${idx}`} className="pl-6 text-xs">
                          <div className="flex items-start gap-1.5">
                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEVERITY_DOTS[finding.severity]}`} />
                            <div>
                              <p className="dark:text-claude-darkText text-claude-text">
                                {i18nService.t(finding.description) || finding.description}
                              </p>
                              <p className="dark:text-claude-darkTextSecondary text-claude-textSecondary mt-0.5">
                                {finding.file}{finding.line ? `:${finding.line}` : ''}
                              </p>
                              {finding.matchedPattern && (
                                <p className="mt-1 px-2 py-1 rounded bg-black/5 dark:bg-white/5 font-mono text-[10px] dark:text-claude-darkTextSecondary text-claude-textSecondary break-all">
                                  {finding.matchedPattern}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-end px-5 py-4 border-t dark:border-claude-darkBorder border-claude-border">
          <button
            type="button"
            onClick={() => onAction('cancel')}
            disabled={isLoading}
            className="px-4 py-2 text-sm rounded-xl dark:text-claude-darkTextSecondary text-claude-textSecondary hover:bg-claude-hover dark:hover:bg-claude-darkHover transition-colors disabled:opacity-50"
          >
            {i18nService.t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => onAction('installDisabled')}
            disabled={isLoading}
            className="px-4 py-2 text-sm rounded-xl dark:bg-claude-darkBgSecondary bg-claude-bgSecondary dark:text-claude-darkText text-claude-text hover:bg-claude-hover dark:hover:bg-claude-darkHover transition-colors border dark:border-claude-darkBorder border-claude-border disabled:opacity-50"
          >
            {i18nService.t('securityInstallDisabled')}
          </button>
          <button
            type="button"
            onClick={() => onAction('install')}
            disabled={isLoading}
            className={`px-4 py-2 text-sm rounded-xl text-white transition-colors disabled:opacity-50 ${
              isCritical
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-claude-accent hover:bg-claude-accent/90'
            }`}
          >
            {i18nService.t('securityInstallAnyway')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SkillSecurityReport;
