import { useAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { Spinner } from "@cloudscape-design/components";
import { I18nProvider } from "@cloudscape-design/components/i18n";
import messages from "@cloudscape-design/components/i18n/messages/all.en";
import "@cloudscape-design/global-styles/index.css";
import { applyMode, Mode } from "@cloudscape-design/global-styles";
import { Amplify } from "aws-amplify";
import { fetchAuthSession } from "aws-amplify/auth";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { FlashbarProvider } from "./common/contexts/Flashbar";
import { ErrorBoundary } from "./common/components";
import Error from "./pages/Error";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import CRM from "./pages/CRM";

const LOCALE = "en";

// Enable dark mode for modern appearance
applyMode(Mode.Dark);

const apiConfig = {
    headers: async () => {
        return {
            Authorization: (await fetchAuthSession()).tokens?.idToken?.toString() ?? "",
        };
    },
};
Amplify.configure(
    {
        Auth: {
            Cognito: {
                userPoolId: import.meta.env.VITE_USER_POOL_ID,
                userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
                identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID,
                allowGuestAccess: false,
                loginWith: {
                    oauth: {
                        domain: import.meta.env.VITE_USER_POOL_DOMAIN_URL,
                        scopes: ["openid"],
                        redirectSignIn: [
                            "http://localhost:3000",
                            import.meta.env.VITE_CALLBACK_URL,
                        ],
                        redirectSignOut: [
                            "http://localhost:3000",
                            import.meta.env.VITE_CALLBACK_URL,
                        ],
                        responseType: "code",
                    },
                },
            },
        },
        API: {
            REST: {
                restApi: {
                    endpoint: String(import.meta.env.VITE_REST_API_URL).slice(0, -1),
                },
            },
        },
    },
    {
        API: {
            REST: apiConfig,
        },
    }
);

export default function App() {
    const { authStatus } = useAuthenticator((context) => [context.authStatus]);

    const router = createBrowserRouter([
        {
            path: "/",
            element: <CRM />,
            errorElement: <Error />,
        },
        {
            path: "/crm/*",
            element: <CRM />,
            errorElement: <Error />,
        },
        {
            path: "*",
            element: <NotFound />,
        },
    ]);

    return (
        <ErrorBoundary>
            <div>
                {authStatus === "configuring" && <Spinner />}
                {authStatus === "unauthenticated" && <Login />}
                {authStatus === "authenticated" && (
                    <>
                        <I18nProvider locale={LOCALE} messages={[messages]}>
                            <FlashbarProvider>
                                <RouterProvider router={router} />
                            </FlashbarProvider>
                        </I18nProvider>
                    </>
                )}
            </div>
        </ErrorBoundary>
    );
}
