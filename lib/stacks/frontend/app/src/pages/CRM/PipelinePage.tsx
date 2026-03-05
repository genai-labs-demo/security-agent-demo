/**
 * Pipeline Dashboard Page — Modern animated layout
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    ContentLayout,
    Header,
    SpaceBetween,
    Container,
    Box,
} from '@cloudscape-design/components';
import { motion } from 'motion/react';
import { StageMetrics } from './components/pipeline/StageMetrics';
import { OpportunityFilters } from './components/pipeline/OpportunityFilters';
import { OpportunityTable } from './components/pipeline/OpportunityTable';
import { calculatePipelineMetrics, calculateWinRate, calculateWeightedForecast, calculateAverageDealSize } from './utils/calculations';
import { filterAndSearchOpportunities } from './utils/filters';
import { OpportunityStage, ForecastCategory, Opportunity } from './types';
import { LoadingSpinner, ErrorAlert } from '../../common/components';
import { useDebounce } from './hooks/useDebounce';
import { fetchOpportunities } from '../../services/api';
import { formatCompactCurrency, formatPercentage } from './utils/formatters';
import AdvancedXSSLab from './components/security/AdvancedXSSLab';

/* ── Quick-insight pill ── */
const InsightPill = ({ label, value, color, delay }: {
    label: string; value: string; color: string; delay: number;
}) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay }}
        style={{
            padding: '14px 20px',
            borderRadius: '14px',
            background: `${color}0a`,
            border: `1px solid ${color}20`,
            position: 'relative',
            overflow: 'hidden',
        }}
    >
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            opacity: 0.5,
        }} />
        <Box variant="small" color="text-label" fontSize="body-s">{label}</Box>
        <div style={{ fontSize: '20px', fontWeight: 700, color, marginTop: '4px', letterSpacing: '-0.02em' }}>
            {value}
        </div>
    </motion.div>
);

export const PipelinePage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

    const [filters, setFilters] = useState({
        dateRange: { start: null as Date | null, end: null as Date | null },
        stage: [] as OpportunityStage[],
        owner: [] as string[],
        forecastCategory: [] as ForecastCategory[],
        searchQuery: '',
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await fetchOpportunities();
                setOpportunities(data);
            } catch {
                setError('Failed to load opportunities. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const debouncedSearchQuery = useDebounce(filters.searchQuery, 300);

    const filteredOpportunities = useMemo(() =>
        filterAndSearchOpportunities(
            opportunities,
            { dateRange: filters.dateRange, stage: filters.stage, owner: filters.owner, forecastCategory: filters.forecastCategory },
            debouncedSearchQuery
        ),
        [opportunities, filters.dateRange, filters.stage, filters.owner, filters.forecastCategory, debouncedSearchQuery]
    );

    const pipelineMetrics = useMemo(() => calculatePipelineMetrics(filteredOpportunities), [filteredOpportunities]);

    const winRate = useMemo(() => calculateWinRate(filteredOpportunities), [filteredOpportunities]);
    const weightedForecast = useMemo(() => calculateWeightedForecast(filteredOpportunities), [filteredOpportunities]);
    const avgDeal = useMemo(() => calculateAverageDealSize(filteredOpportunities), [filteredOpportunities]);

    const handleFilterChange = useCallback((newFilters: typeof filters) => {
        setFilters(newFilters);
    }, []);

    const handleRetry = useCallback(() => {
        setError(null);
        setLoading(true);
        fetchOpportunities()
            .then(setOpportunities)
            .catch(() => setError('Failed to load opportunities.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <ContentLayout header={<Header variant="h1" description="Track and manage your sales opportunities across all pipeline stages">Pipeline Dashboard</Header>}>
                <LoadingSpinner message="Loading pipeline data..." />
            </ContentLayout>
        );
    }

    if (error) {
        return (
            <ContentLayout header={<Header variant="h1" description="Track and manage your sales opportunities across all pipeline stages">Pipeline Dashboard</Header>}>
                <ErrorAlert header="Failed to load pipeline" message={error} onRetry={handleRetry} showReload={true} />
            </ContentLayout>
        );
    }

    return (
        <ContentLayout
            header={
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                    <Header
                        variant="h1"
                        description="Track and manage your sales opportunities across all pipeline stages"
                        counter={`(${filteredOpportunities.length})`}
                    >
                        Pipeline Dashboard
                    </Header>
                </motion.div>
            }
        >
            <SpaceBetween size="l">
                {/* Advanced XSS Security Lab */}
                <AdvancedXSSLab />

                {/* Quick Insights Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    <InsightPill label="Win Rate" value={formatPercentage(winRate)} color="#22c55e" delay={0.05} />
                    <InsightPill label="Weighted Forecast" value={formatCompactCurrency(weightedForecast)} color="#6366f1" delay={0.1} />
                    <InsightPill label="Avg Deal Size" value={formatCompactCurrency(avgDeal)} color="#3b82f6" delay={0.15} />
                    <InsightPill label="Active Deals" value={`${filteredOpportunities.filter(o => o.stage !== OpportunityStage.ClosedWon && o.stage !== OpportunityStage.ClosedLost).length}`} color="#f59e0b" delay={0.2} />
                </div>

                {/* Stage Metrics */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
                    <Container header={<Header variant="h2">Pipeline Stages</Header>}>
                        <StageMetrics metrics={pipelineMetrics} />
                    </Container>
                </motion.div>

                {/* Filters */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                    <OpportunityFilters
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        showForecastFilter={true}
                    />
                </motion.div>

                {/* Opportunities Table */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
                    <OpportunityTable
                        opportunities={filteredOpportunities}
                        headerText="Opportunities"
                        headerDescription={`Showing ${filteredOpportunities.length} of ${opportunities.length} opportunities`}
                        loading={false}
                    />
                </motion.div>
            </SpaceBetween>
        </ContentLayout>
    );
};

export default PipelinePage;
