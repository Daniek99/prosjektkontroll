-- ============================================================================
-- Activity-based risk assessment
-- ----------------------------------------------------------------------------
-- The risk register is now tied to work activities. An activity can be marked
-- for risk assessment when it is created; it then appears on the Risikostyring
-- page where dangers, solutions and the initiation time can be filled in.
-- ============================================================================

ALTER TABLE work_activities
  ADD COLUMN IF NOT EXISTS risk_assessment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_dangers TEXT,
  ADD COLUMN IF NOT EXISTS risk_solutions TEXT,
  ADD COLUMN IF NOT EXISTS risk_initiation_time TEXT;

CREATE INDEX IF NOT EXISTS idx_work_activities_risk ON work_activities(risk_assessment);

-- The Risikostyring page reads work_activities, so users with the "risks"
-- dataset need access to it as well.
DROP POLICY IF EXISTS project_scoped_access ON work_activities;
CREATE POLICY project_scoped_access ON work_activities FOR ALL TO authenticated
  USING (
    project_id = current_project_id()
    AND (is_project_member(project_id) OR is_master())
    AND has_any_dataset_access('{dashboard,progress,bemanning,risks}'::text[])
  )
  WITH CHECK (
    project_id = current_project_id()
    AND (is_project_member(project_id) OR is_master())
    AND has_any_dataset_access('{dashboard,progress,bemanning,risks}'::text[])
  );

-- Verification
SELECT 'Activity risk assessment migration completed' AS status,
       (SELECT count(*) FROM work_activities WHERE risk_assessment = true) AS flagged_activities;
