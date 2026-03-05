import {
    BreadcrumbGroup,
    ContentLayout,
    SpaceBetween,
} from "@cloudscape-design/components";
import { useLocation, useNavigate, Routes, Route } from "react-router-dom";
import Layout from "../../common/components/Layout";
import { ErrorBoundary } from "../../common/components";
import CRMNavigation from "./components/layout/CRMNavigation";
import { CRMProvider } from "./context/CRMContext";
import PipelinePage from "./PipelinePage";
import AccountsPage from "./AccountsPage";
import MyOpportunitiesPage from "./MyOpportunitiesPage";
import TeamPerformancePage from "./TeamPerformancePage";
import SecurityPage from "./SecurityPage";
import DocumentViewerPage, { DocumentIndex } from "./DocumentViewerPage";

const CRM = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const getBreadcrumbs = () => {
        const pathSegments = location.pathname.split('/').filter(Boolean);
        const breadcrumbs = [
            { text: "Home", href: "/" },
            { text: "AnyCompany CRM App", href: "/crm" }
        ];

        if (pathSegments.length > 1) {
            const page = pathSegments[1];
            switch (page) {
                case 'pipeline':
                    breadcrumbs.push({ text: "Pipeline", href: "/crm/pipeline" });
                    break;
                case 'accounts':
                    breadcrumbs.push({ text: "Accounts", href: "/crm/accounts" });
                    break;
                case 'my-opportunities':
                    breadcrumbs.push({ text: "My Opportunities", href: "/crm/my-opportunities" });
                    break;
                case 'team':
                    breadcrumbs.push({ text: "Team Performance", href: "/crm/team" });
                    break;
                case 'security':
                    breadcrumbs.push({ text: "Security Demo", href: "/crm/security" });
                    break;
                case 'docs':
                    breadcrumbs.push({ text: "Design Docs", href: "/crm/docs" });
                    if (pathSegments.length > 2) {
                        const docNames: Record<string, string> = {
                            'architecture-overview': 'Architecture Overview',
                            'data-flow': 'Data Flow',
                            'security-controls': 'Security Controls',
                            'threat-model': 'Threat Model',
                        };
                        const docSlug = pathSegments[2];
                        if (docNames[docSlug]) {
                            breadcrumbs.push({ text: docNames[docSlug], href: location.pathname });
                        }
                    }
                    break;
                default:
                    breadcrumbs.push({ text: page, href: location.pathname });
            }
        }

        return breadcrumbs;
    };

    const isSecurityLanding = location.pathname === "/" || location.pathname === "/crm" || location.pathname === "/crm/" || location.pathname === "/crm/security";

    return (
        <CRMProvider>
            <Layout
                navigation={<CRMNavigation />}
                breadcrumbs={
                    isSecurityLanding ? undefined :
                    <BreadcrumbGroup
                        items={getBreadcrumbs()}
                        onFollow={(event) => {
                            event.preventDefault();
                            navigate(event.detail.href);
                        }}
                    />
                }
                content={
                    isSecurityLanding ? (
                        <ErrorBoundary>
                            <Routes>
                                <Route index element={<SecurityPage />} />
                                <Route path="security" element={<SecurityPage />} />
                            </Routes>
                        </ErrorBoundary>
                    ) : (
                        <ContentLayout>
                            <SpaceBetween size="l">
                                <ErrorBoundary>
                                    <Routes>
                                        <Route index element={<SecurityPage />} />
                                        <Route path="pipeline" element={<PipelinePage />} />
                                        <Route path="accounts" element={<AccountsPage />} />
                                        <Route path="my-opportunities" element={<MyOpportunitiesPage />} />
                                        <Route path="team" element={<TeamPerformancePage />} />
                                        <Route path="security" element={<SecurityPage />} />
                                        <Route path="docs" element={<DocumentIndex />} />
                                        <Route path="docs/:docSlug" element={<DocumentViewerPage />} />
                                    </Routes>
                                </ErrorBoundary>
                            </SpaceBetween>
                        </ContentLayout>
                    )
                }
            />
        </CRMProvider>
    );
};

export default CRM;
