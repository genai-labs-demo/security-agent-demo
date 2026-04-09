const { CodeBuildClient, StartBuildCommand, BatchGetBuildsCommand } = require("@aws-sdk/client-codebuild");

const codeBuildClient = new CodeBuildClient();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.handler = async (event) => {
    const projectName = event.ResourceProperties.ProjectName;
    
    // Handle DELETE requests - no build needed
    if (event.RequestType === "Delete") {
        return { PhysicalResourceId: event.PhysicalResourceId };
    }
    
    // Start the CodeBuild project
    const { build } = await codeBuildClient.send(
        new StartBuildCommand({ projectName })
    );
    console.log("Started:", build.id);
    
    // Poll for build completion (max 15 minutes: 90 iterations * 10 seconds)
    for (let i = 0; i < 90; i++) {
        await sleep(10000);
        
        const response = await codeBuildClient.send(
            new BatchGetBuildsCommand({ ids: [build.id] })
        );
        
        const status = response.builds[0].buildStatus;
        console.log("Status:", status);
        
        if (status === "SUCCEEDED") {
            return { PhysicalResourceId: build.id };
        }
        
        if (["FAILED", "FAULT", "STOPPED", "TIMED_OUT"].includes(status)) {
            throw new Error(`CodeBuild ${status}: ${build.id}`);
        }
    }
    
    throw new Error("Build timed out");
};
