-- Add a `type` column to the subcontractors table so an entry can be either a
-- regular subcontractor or an internal "project". Projects are used the same way
-- as subcontractors (activities, change orders, manpower, etc. all reference
-- subcontractor_id), but do not require an organization number or company details.
ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'subcontractor';
