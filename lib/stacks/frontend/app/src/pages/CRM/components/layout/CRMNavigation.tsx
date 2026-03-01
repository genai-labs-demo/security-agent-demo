import { SideNavigation } from "@cloudscape-design/components";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface CRMNavigationProps {
    activeHref?: string;
}

const CRMNavigation = ({ activeHref: propActiveHref }: CRMNavigationProps) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeHref, setActiveHref] = useState(propActiveHref || location.pathname);

    useEffect(() => {
        setActiveHref(location.pathname);
    }, [location.pathname]);

    const handleNavigationChange = (event: any) => {
        if (!event.detail.external) {
            event.preventDefault();
            const href = event.detail.href;
            setActiveHref(href);
            navigate(href);
        }
    };

    return (
        <SideNavigation
            header={{
                text: "AnyCompany CRM",
                href: "/crm"
            }}
            activeHref={activeHref}
            onFollow={handleNavigationChange}
            items={[
                {
                    type: "section" as const,
                    text: "Security",
                    defaultExpanded: true,
                    items: [
                        {
                            type: "link" as const,
                            text: "Security Agent",
                            href: "/crm",
                        }
                    ]
                },
                { type: "divider" as const },
                {
                    type: "section" as const,
                    text: "App",
                    items: [
                        {
                            type: "link" as const,
                            text: "Pipeline",
                            href: "/crm/pipeline",
                        },
                        {
                            type: "link" as const,
                            text: "Accounts",
                            href: "/crm/accounts",
                        },
                        {
                            type: "link" as const,
                            text: "My Opportunities",
                            href: "/crm/my-opportunities",
                        },
                        {
                            type: "link" as const,
                            text: "Team Performance",
                            href: "/crm/team",
                        }
                    ]
                }
            ]}
        />
    );
};

export default CRMNavigation;
