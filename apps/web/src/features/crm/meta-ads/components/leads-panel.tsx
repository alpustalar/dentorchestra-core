'use client';

import { Fragment, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MetaLeadResponse } from '@dentorchestra/shared/client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useMatchLeadToPatient, useMetaLeads, type MetaLeadStatus } from '../api/use-meta-leads';
import { PatientMatchPicker } from './patient-match-picker';
import { EmptyState, errorMessage, formatDateTime, Notice, truncateId } from './panel-ui';

const STATUS_FILTERS: Array<MetaLeadStatus | undefined> = [
  undefined,
  'NEW',
  'MATCHED',
  'CONVERTED',
  'INVALID',
];
const PAGE_SIZE = 10;

interface LeadsPanelProps {
  clinicId: string | null;
  isDemo: boolean;
  demoLeads?: MetaLeadResponse[];
  canMatch: boolean;
}

export function LeadsPanel({ clinicId, isDemo, demoLeads, canMatch }: LeadsPanelProps) {
  const t = useTranslations('MetaAds');
  const locale = useLocale();

  const [status, setStatus] = useState<MetaLeadStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [matchingLeadId, setMatchingLeadId] = useState<string | null>(null);

  const leadsQuery = useMetaLeads({
    clinicId: isDemo ? null : clinicId,
    status,
    pagination: { page, limit: PAGE_SIZE },
  });
  const matchMutation = useMatchLeadToPatient(clinicId ?? '');

  const demoFiltered = (demoLeads ?? []).filter((lead) => !status || lead.status === status);
  const leads = isDemo ? demoFiltered : leadsQuery.data?.data ?? [];
  const pagination = isDemo ? undefined : leadsQuery.data?.pagination;
  const isLoading = !isDemo && Boolean(clinicId) && leadsQuery.isPending;

  const handleMatch = (leadId: string, patientId: string) => {
    matchMutation.mutate(
      { leadId, patientId },
      { onSuccess: () => setMatchingLeadId(null) }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('leadsTitle')}</CardTitle>
        <CardDescription>{t('leadsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((option) => (
            <Button
              key={option ?? 'ALL'}
              type="button"
              size="sm"
              variant={status === option ? 'default' : 'outline'}
              onClick={() => {
                setStatus(option);
                setPage(1);
              }}
            >
              {option ? t(`status.${option}`) : t('statusFilterAll')}
            </Button>
          ))}
        </div>

        {!isDemo && leadsQuery.isError && (
          <Notice error message={errorMessage(leadsQuery.error) ?? t('leadsLoadError')} />
        )}
        {matchMutation.isError && (
          <Notice error message={errorMessage(matchMutation.error) ?? t('matchError')} />
        )}

        {isLoading ? (
          <EmptyState label={t('loading')} />
        ) : leads.length === 0 ? (
          <EmptyState label={t('noLeads')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3 font-medium">{t('columnName')}</th>
                  <th className="pb-2 pr-3 font-medium">{t('columnPhone')}</th>
                  <th className="pb-2 pr-3 font-medium">{t('columnCampaign')}</th>
                  <th className="pb-2 pr-3 font-medium">{t('columnStatus')}</th>
                  <th className="pb-2 pr-3 font-medium">{t('columnMatchedPatient')}</th>
                  <th className="pb-2 font-medium">{t('createdAt')}</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <Fragment key={lead.id}>
                    <tr className="border-b last:border-0">
                      <td className="py-2.5 pr-3">{lead.name || '—'}</td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {lead.phone || '—'}
                      </td>
                      <td className="max-w-40 truncate py-2.5 pr-3 text-xs text-muted-foreground">
                        {lead.campaignName || '—'}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge
                          variant={
                            lead.status === 'CONVERTED'
                              ? 'secondary'
                              : lead.status === 'INVALID'
                                ? 'destructive'
                                : 'outline'
                          }
                        >
                          {t(`status.${lead.status}`)}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">
                        {lead.matchedPatientId ? (
                          <span className="font-mono text-muted-foreground">
                            {truncateId(lead.matchedPatientId)}
                          </span>
                        ) : canMatch &&
                          (lead.status === 'NEW' || lead.status === 'MATCHED') &&
                          clinicId ? (
                          matchingLeadId !== lead.id && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isDemo}
                              onClick={() => setMatchingLeadId(lead.id)}
                            >
                              {t('matchButton')}
                            </Button>
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {formatDateTime(String(lead.createdAt), locale)}
                      </td>
                    </tr>
                    {matchingLeadId === lead.id && clinicId && (
                      <tr className="border-b last:border-0">
                        <td colSpan={6} className="py-2">
                          <PatientMatchPicker
                            clinicId={clinicId}
                            disabled={matchMutation.isPending}
                            onCancel={() => setMatchingLeadId(null)}
                            onSelect={(patient) => handleMatch(lead.id, patient.id)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {t('page', { page: pagination.page, totalPages: pagination.totalPages })}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {t('previous')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((current) => Math.min(pagination.totalPages, current + 1))
                }
                disabled={page >= pagination.totalPages}
              >
                {t('next')}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
