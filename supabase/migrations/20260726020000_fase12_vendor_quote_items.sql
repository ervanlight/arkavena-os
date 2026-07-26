-- 1. Create vendor_quote_items table
CREATE TABLE IF NOT EXISTS public.vendor_quote_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    vendor_quote_id uuid NOT NULL REFERENCES public.vendor_quotes(id) ON DELETE CASCADE,
    group_name text,
    description text NOT NULL,
    quantity numeric NOT NULL DEFAULT 1,
    unit text NOT NULL DEFAULT 'ls',
    unit_cost numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_vendor_quote_items_vendor_quote_id ON public.vendor_quote_items(vendor_quote_id);

-- 2. Alter estimate_items to add group_name
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS group_name text;

-- 3. RLS for vendor_quote_items
ALTER TABLE public.vendor_quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vendor_quote_items in their org"
    ON public.vendor_quote_items FOR SELECT
    USING (organization_id = (SELECT auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can insert vendor_quote_items in their org"
    ON public.vendor_quote_items FOR INSERT
    WITH CHECK (organization_id = (SELECT auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can update vendor_quote_items in their org"
    ON public.vendor_quote_items FOR UPDATE
    USING (organization_id = (SELECT auth.jwt() ->> 'org_id')::uuid)
    WITH CHECK (organization_id = (SELECT auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Users can delete vendor_quote_items in their org"
    ON public.vendor_quote_items FOR DELETE
    USING (organization_id = (SELECT auth.jwt() ->> 'org_id')::uuid);

-- 4. View for Partner Desk to see their own quote items
CREATE OR REPLACE VIEW public.vw_partner_vendor_quote_items AS
SELECT
    vqi.id,
    vqi.vendor_quote_id,
    vqi.group_name,
    vqi.description,
    vqi.quantity as volume,
    vqi.unit,
    vqi.unit_cost,
    vqi.created_at
FROM public.vendor_quote_items vqi
JOIN public.vendor_quotes vq ON vqi.vendor_quote_id = vq.id
WHERE vq.vendor_id = (SELECT auth.jwt() ->> 'org_id')::uuid
  AND vqi.deleted_at IS NULL;
