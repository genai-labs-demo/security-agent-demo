/**
 * Team Performance Page
 * 
 * Manager dashboard for viewing team-wide performance metrics and individual
 * sales rep performance.
 * 
 * Features:
 * - Team-wide pipeline metrics
 * - Individual rep performance cards
 * - Time period filtering (This Quarter, This Month, This Year)
 * - Pipeline velocity and growth metrics
 * - Performance visualizations
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ContentLayout,
  Header,
  SpaceBetween,
  Container,
  Grid,
  Box,
  Input,
  Button,
  FormField,
} from '@cloudscape-design/components';
import { TeamMetrics } from './components/team/TeamMetrics';
import { RepPerformanceCard } from './components/team/RepPerformanceCard';
import { PerformanceChart } from './components/team/PerformanceChart';
import { mockOpportunities } from './data/mockOpportunities';
import { mockTeamMembers } from './data/mockTeamData';
import {
  calculatePipelineMetrics,
  calculateWinRate,
  calculateAverageDealSize,
  calculatePipelineVelocity,
} from './utils/calculations';
import { OpportunityStage, ChartDataPoint } from './types';
import { LoadingSpinner, ErrorAlert } from '../../common/components';
import CommandInjectionLab from './components/security/CommandInjectionLab';

/**
 * TeamPerformancePage Component
 * 
 * Displays team-wide metrics and individual rep performance with time period filtering.
 */
export const TeamPerformancePage: React.FC = () => {
  // Loading and error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');

  // Simulate data loading
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        await new Promise(resolve => setTimeout(resolve, 450));
        setLoading(false);
      } catch (err) {
        setError('Failed to load team performance data. Please try again.');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter opportunities by current quarter
  const filteredOpportunities = useMemo(() => {
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);

    return mockOpportunities.filter((opp) => {
      const oppDate = new Date(opp.createdDate);
      return oppDate >= startDate;
    });
  }, []);

  // Calculate team-wide metrics
  // Memoized to prevent recalculation on every render
  const teamMetrics = useMemo(() => {
    const pipelineMetrics = calculatePipelineMetrics(filteredOpportunities);
    const winRate = calculateWinRate(filteredOpportunities);
    const averageDealSize = calculateAverageDealSize(filteredOpportunities);
    const pipelineVelocity = calculatePipelineVelocity(filteredOpportunities);

    const result = {
      totalPipeline: pipelineMetrics.openPipeline,
      totalWon: pipelineMetrics.wonOpportunities,
      winRate,
      totalOpportunities: filteredOpportunities.filter(
        (opp) =>
          opp.stage !== OpportunityStage.ClosedWon &&
          opp.stage !== OpportunityStage.ClosedLost
      ).length,
      averageDealSize,
      pipelineVelocity,
    };
    return result;
  }, [filteredOpportunities]);

  // Generate pipeline trend chart data (last 6 months)
  // Memoized to prevent recalculation on every render
  const pipelineTrendData = useMemo((): ChartDataPoint[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const now = new Date();
    
    return months.map((month, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      
      // Calculate pipeline value for this month
      const monthOpportunities = mockOpportunities.filter((opp) => {
        const oppDate = new Date(opp.createdDate);
        return (
          oppDate.getMonth() === monthDate.getMonth() &&
          oppDate.getFullYear() === monthDate.getFullYear() &&
          opp.stage !== OpportunityStage.ClosedWon &&
          opp.stage !== OpportunityStage.ClosedLost
        );
      });
      
      const pipelineValue = monthOpportunities.reduce((sum, opp) => sum + opp.amount, 0);
      
      return {
        x: month,
        y: pipelineValue / 1000000, // Convert to millions for readability
        label: month,
      };
    });
  }, []);

  // Generate win rate by rep chart data
  // Memoized to prevent recalculation on every render
  const winRateByRepData = useMemo((): ChartDataPoint[] => {
    return mockTeamMembers
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 8) // Top 8 reps
      .map((member) => ({
        x: member.name.split(' ')[0], // First name only for chart
        y: member.winRate,
        label: member.name.split(' ')[0],
      }));
  }, []);

  // Handle retry
  // Memoized with useCallback to prevent function recreation on every render
  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    setTimeout(() => setLoading(false), 450);
  }, []);

  // Filter team members by name
  const filteredMembers = useMemo(() => {
    const sorted = [...mockTeamMembers].sort((a, b) => b.quotaAttainment - a.quotaAttainment);
    if (!nameFilter.trim()) return sorted;
    return sorted.filter(m => m.name.toLowerCase().includes(nameFilter.toLowerCase()));
  }, [nameFilter]);

  // Export team performance to CSV
  const exportCSV = () => {
    const header = 'Name,Role,Quota,Pipeline Value,Closed Won,Quota Attainment %,Win Rate %,Opportunities';
    const rows = filteredMembers.map(m =>
      `${m.name},${m.role},${m.quota},${m.pipelineValue},${m.closedWonValue},${m.quotaAttainment},${m.winRate},${m.opportunityCount}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-performance-${nameFilter || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Show loading state
  if (loading) {
    return (
      <ContentLayout
        header={
          <Header
            variant="h1"
            description="Monitor team performance, quota attainment, and pipeline health"
          >
            Team Performance
          </Header>
        }
      >
        <LoadingSpinner message="Loading team performance data..." />
      </ContentLayout>
    );
  }

  // Show error state
  if (error) {
    return (
      <ContentLayout
        header={
          <Header
            variant="h1"
            description="Monitor team performance, quota attainment, and pipeline health"
          >
            Team Performance
          </Header>
        }
      >
        <ErrorAlert
          header="Failed to load team performance"
          message={error}
          onRetry={handleRetry}
          showReload={true}
        />
      </ContentLayout>
    );
  }

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Monitor team performance, quota attainment, and pipeline health"
        >
          Team Performance
        </Header>
      }
    >
      <SpaceBetween size="l">
        {/* Command Injection Security Lab */}
        <CommandInjectionLab />

        {/* Team-Wide Metrics */}
        <Container
          header={
            <Header variant="h2" description="Aggregate metrics across all team members">
              Team Metrics
            </Header>
          }
        >
          <TeamMetrics
            totalPipeline={teamMetrics.totalPipeline}
            totalWon={teamMetrics.totalWon}
            winRate={teamMetrics.winRate}
            totalOpportunities={teamMetrics.totalOpportunities}
            averageDealSize={teamMetrics.averageDealSize}
            pipelineVelocity={teamMetrics.pipelineVelocity}
          />
        </Container>

        {/* Performance Charts */}
        <Grid 
          gridDefinition={[
            { colspan: { default: 12, xxs: 12, xs: 12, s: 12, m: 6 } },
            { colspan: { default: 12, xxs: 12, xs: 12, s: 12, m: 6 } },
          ]}
        >
          <PerformanceChart
            data={pipelineTrendData}
            type="line"
            title="Pipeline Trend"
            description="Pipeline value over the last 6 months (in millions)"
            xAxisLabel="Month"
          />
          <PerformanceChart
            data={winRateByRepData}
            type="bar"
            title="Win Rate by Rep"
            description="Top performing sales representatives"
            xAxisLabel="Sales Rep"
          />
        </Grid>

        {/* Individual Rep Performance */}
        <Container
          header={
            <Header
              variant="h2"
              description="Individual performance metrics and quota attainment"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button onClick={exportCSV} iconName="download">Export CSV</Button>
                  <Button onClick={() => window.print()} iconName="file">Export PDF</Button>
                </SpaceBetween>
              }
            >
              Individual Performance
            </Header>
          }
        >
          <SpaceBetween size="m">
            <FormField label="Filter by name">
              <Input
                value={nameFilter}
                onChange={({ detail }) => setNameFilter(detail.value)}
                placeholder="Search team members..."
                type="search"
                clearAriaLabel="Clear filter"
              />
            </FormField>
            <Grid
              gridDefinition={filteredMembers.map(() => ({ colspan: { default: 12, xs: 6, s: 4, l: 2 } }))}
            >
              {filteredMembers.map((member) => (
                <RepPerformanceCard key={member.id} member={member} />
              ))}
            </Grid>
            {filteredMembers.length === 0 && (
              <Box textAlign="center" color="text-body-secondary" padding="l">No team members match "{nameFilter}"</Box>
            )}
          </SpaceBetween>
        </Container>

        {/* Additional Insights */}
        <Container
          header={
            <Header variant="h2" description="Key insights and trends">
              Performance Insights
            </Header>
          }
        >
          <SpaceBetween size="m">
            <Box>
              <Box variant="awsui-key-label" margin={{ bottom: 'xxs' }}>
                Pipeline Growth
              </Box>
              <Box fontSize="heading-l" fontWeight="bold" color="text-status-success">
                +12.5%
              </Box>
              <Box variant="small" color="text-body-secondary">
                Compared to previous quarter
              </Box>
            </Box>
            <Box>
              <Box variant="awsui-key-label" margin={{ bottom: 'xxs' }}>
                Top Performer
              </Box>
              <Box fontSize="heading-l" fontWeight="bold">
                {mockTeamMembers.sort((a, b) => b.quotaAttainment - a.quotaAttainment)[0]?.name}
              </Box>
              <Box variant="small" color="text-body-secondary">
                {mockTeamMembers.sort((a, b) => b.quotaAttainment - a.quotaAttainment)[0]?.quotaAttainment.toFixed(1)}% quota attainment
              </Box>
            </Box>
            <Box>
              <Box variant="awsui-key-label" margin={{ bottom: 'xxs' }}>
                Team Quota Attainment
              </Box>
              <Box fontSize="heading-l" fontWeight="bold">
                {(
                  (mockTeamMembers.reduce((sum, m) => sum + m.closedWonValue, 0) /
                    mockTeamMembers.reduce((sum, m) => sum + m.quota, 0)) *
                  100
                ).toFixed(1)}%
              </Box>
              <Box variant="small" color="text-body-secondary">
                Aggregate team performance against quota
              </Box>
            </Box>
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default TeamPerformancePage;
