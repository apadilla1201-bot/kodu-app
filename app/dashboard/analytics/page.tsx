export const dynamic = 'force-dynamic';

import { DashboardShell } from '@/components/dashboard-shell';
import { PortfolioAnalyticsContent } from '@/components/portfolio-analytics-content';

export default function AnalyticsPage() {
  return (
    <DashboardShell>
      <div className="p-6 lg:p-8">
        <PortfolioAnalyticsContent />
      </div>
    </DashboardShell>
  );
}
