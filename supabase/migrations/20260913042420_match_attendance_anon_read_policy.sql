-- Allow public (anon) read access to match_attendance
-- This is needed for the Hall of Fame "Melhor Presença" card on the public dashboard.
-- Attendance data is not sensitive (just "who showed up to games").

CREATE POLICY "attendance_public_select"
  ON match_attendance FOR SELECT
  TO anon, authenticated
  USING (true);
