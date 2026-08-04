import { TeamDashboard, useTeamDashboard } from '@/components/TeamDashboard';

export function PublicDashboard() {
  const { data, loading, error, reload } = useTeamDashboard();
  return <TeamDashboard data={data} loading={loading} error={error} reload={reload} linkPrefix="" />;
}
