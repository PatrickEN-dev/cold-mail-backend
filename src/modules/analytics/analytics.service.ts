import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';

export interface PipelineMetric {
  campaignName: string;
  totalLeads: number;
  replied: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  pipelineValue: number;
  closedWonValue: number;
  replyRate: number;
  winRate: number;
}

export interface SenderEmailStat {
  senderEmailId: string;
  total: number;
  sent: number;
  replied: number;
  bounced: number;
  opened: number;
}

/// Wave 6: mirrors the three Supabase RPCs (pipeline_metrics, sender_email_stats,
/// user_campaign_names) but receives `user_id` explicitly because the RPCs in
/// prod rely on `auth.uid()` which is NULL when we connect with the service-role.
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async pipelineMetrics(userId: string): Promise<PipelineMetric[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        campaign_name: string;
        total_leads: bigint;
        replied: bigint;
        open_deals: bigint;
        won_deals: bigint;
        lost_deals: bigint;
        pipeline_value: number;
        closed_won_value: number;
        reply_rate: number;
        win_rate: number;
      }>
    >`
      SELECT
        COALESCE(NULLIF(e.campaign_name, ''), '(no campaign)') AS campaign_name,
        COUNT(*)                                                              AS total_leads,
        COUNT(*) FILTER (WHERE e.status = 'replied')                          AS replied,
        COUNT(*) FILTER (WHERE e.deal_status = 'open')                        AS open_deals,
        COUNT(*) FILTER (WHERE e.deal_status = 'won')                         AS won_deals,
        COUNT(*) FILTER (WHERE e.deal_status = 'lost')                        AS lost_deals,
        COALESCE(SUM(e.deal_value) FILTER (WHERE e.deal_status = 'open'), 0)  AS pipeline_value,
        COALESCE(SUM(e.deal_value) FILTER (WHERE e.deal_status = 'won'),  0)  AS closed_won_value,
        CASE
          WHEN COUNT(*) FILTER (WHERE e.status IN ('sent','replied','opened','bounced')) = 0 THEN 0
          ELSE ROUND(
            COUNT(*) FILTER (WHERE e.status = 'replied')::numeric
            / COUNT(*) FILTER (WHERE e.status IN ('sent','replied','opened','bounced')) * 100, 2
          )
        END AS reply_rate,
        CASE
          WHEN COUNT(*) FILTER (WHERE e.deal_status IN ('won','lost')) = 0 THEN 0
          ELSE ROUND(
            COUNT(*) FILTER (WHERE e.deal_status = 'won')::numeric
            / COUNT(*) FILTER (WHERE e.deal_status IN ('won','lost')) * 100, 2
          )
        END AS win_rate
      FROM emails e
      WHERE e.user_id = ${userId}::uuid
      GROUP BY COALESCE(NULLIF(e.campaign_name, ''), '(no campaign)')
      ORDER BY closed_won_value DESC, pipeline_value DESC
    `;
    return rows.map((r) => ({
      campaignName: r.campaign_name,
      totalLeads: Number(r.total_leads),
      replied: Number(r.replied),
      openDeals: Number(r.open_deals),
      wonDeals: Number(r.won_deals),
      lostDeals: Number(r.lost_deals),
      pipelineValue: Number(r.pipeline_value),
      closedWonValue: Number(r.closed_won_value),
      replyRate: Number(r.reply_rate),
      winRate: Number(r.win_rate),
    }));
  }

  async senderEmailStats(userId: string): Promise<SenderEmailStat[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        sender_email_id: string;
        total: bigint;
        sent: bigint;
        replied: bigint;
        bounced: bigint;
        opened: bigint;
      }>
    >`
      SELECT
        e.sender_email_id,
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE e.status = 'sent')         AS sent,
        COUNT(*) FILTER (WHERE e.status = 'replied')      AS replied,
        COUNT(*) FILTER (WHERE e.status = 'bounced')      AS bounced,
        COUNT(*) FILTER (WHERE e.status = 'opened')       AS opened
      FROM emails e
      WHERE e.user_id = ${userId}::uuid AND e.sender_email_id IS NOT NULL
      GROUP BY e.sender_email_id
    `;
    return rows.map((r) => ({
      senderEmailId: r.sender_email_id,
      total: Number(r.total),
      sent: Number(r.sent),
      replied: Number(r.replied),
      bounced: Number(r.bounced),
      opened: Number(r.opened),
    }));
  }

  async userCampaignNames(userId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ campaign_name: string }>>`
      SELECT DISTINCT e.campaign_name
      FROM emails e
      WHERE e.user_id = ${userId}::uuid
        AND e.campaign_name IS NOT NULL
        AND e.campaign_name <> ''
      ORDER BY e.campaign_name
    `;
    return rows.map((r) => r.campaign_name);
  }
}
