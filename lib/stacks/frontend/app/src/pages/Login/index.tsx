// @export {"replace": ", Button, Divider, Flex ", "with": ""}
import { Authenticator, Button, Divider, Flex, View, Text } from "@aws-amplify/ui-react";
// @export {"deleteLines": 2}
import { signInWithRedirect } from "aws-amplify/auth";
import Amazicon from "./amazicon.svg";

const Login = () => {
    return (
        <Authenticator
            // @export {"replace": "true", "with": "false"}
            hideSignUp={true}
            variation="modal"
            // socialProviders={["amazon"]}
            // @export {"deleteLines": 19}
            components={{
                SignIn: {
                    Header: () => {
                        return (
                            <Flex direction="column" padding="2rem 2rem 0">
                                <Button onClick={() => signInWithRedirect()} gap="1rem" isFullWidth>
                                    <img
                                        src={Amazicon}
                                        alt="Amazon icon"
                                        style={{ width: "15px" }}
                                    />
                                    Sign in with Midway
                                </Button>
                                <Divider label="or" size="small" />
                            </Flex>
                        );
                    },
                    Footer: () => {
                        return (
                            <View
                                padding="1rem 2rem 2rem"
                            >
                                <View
                                    backgroundColor="rgba(0, 0, 0, 0.06)"
                                    borderRadius="8px"
                                    padding="12px 16px"
                                    border="1px solid rgba(0, 0, 0, 0.15)"
                                >
                                    <Text fontSize="13px" color="#232f3e" fontWeight="600" marginBottom="4px">
                                        Demo Credentials
                                    </Text>
                                    <Text fontSize="12px" color="#545b64">
                                        Username: user_test@example.com
                                    </Text>
                                    <Text fontSize="12px" color="#545b64">
                                        Password: AWS123xyz!
                                    </Text>
                                </View>
                            </View>
                        );
                    },
                },
            }}
        />
    );
};

export default Login;
