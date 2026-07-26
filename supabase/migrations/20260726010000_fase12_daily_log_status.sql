-- Fase 12: Add approval status to daily_logs (ARCHITECTURE.md 1.2, 2.1)
-- Daily reports submitted by Site Coordinators need PM review before being published.

create type daily_log_status as enum ('draft', 'pending_review', 'published', 'rejected');

alter table daily_logs 
add column status daily_log_status not null default 'draft';

-- Update all existing logs to be published so we don't break existing mock data
update daily_logs set status = 'published';

-- Change the default for new ones coming from Site Coordinator to pending_review
alter table daily_logs alter column status set default 'pending_review';

comment on column daily_logs.status is 'Approval status. SiteFlow creates as pending_review. Command Center PMs review and change to published or rejected.';
