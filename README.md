# Lab 6: Serverless CI/CD on AWS

## Lab overview
Now you have a fully functional serverless application that allows users to sign in, save bookmarks for their own use, and submit bookmarks to be shared in the team knowledge base. Several tasks happen in parallel when a new bookmark is submitted for the knowledge base: The submitter’s entry is entered into a contest, notifications are sent, and an automated publishing workflow is initiated. You have also incorporated logging and tracing, which will give you operational visibility into the production application. Finally, you incorporated security at all layers to protect your application.

As you have learned, a key part of developing serverless applications is to use your visibility into how the application is used in production to determine where to make future modifications. You should continue to monitor the production application to understand access patterns, resolve operational errors, and iteratively optimize your application to minimize costs and continually improve the user experience. Because your application uses small decoupled components, you can more easily modify components independently. To support these types of small, frequent updates, you would like to automate the build and deployment processes so that the development team continues to focus on developing the application. In this lab, you learn how to set up a continuous integration and continuous delivery (CI/CD) pipeline and do canary deployments on AWS.

The following diagram shows the architecture components that have been or will be deployed in this lab.

IMG

This lab uses the following services:

* AWS Serverless Application Model (AWS SAM)
* Amazon DynamoDB
* Amazon EventBridge
* Amazon Simple Notification Service (Amazon SNS)
* AWS Step Functions
* AWS CodeCommit
* AWS CodePipeline
* AWS CodeBuild
* AWS CodeDeploy
* AWS Cloud Development Kit (AWS CDK)

### Objectives

After completing this lab, you will be able to:

* Create a CodeCommit repository and a CI/CD pipeline
* Use AWS SAM to define the resources that your application needs and the AWS CDK to define the resources for the deployment infrastructure
* Implement canary deployments using AWS SAM
* Monitor your canary deployment with CodeDeploy

## Task 1: Understanding key services and setting up the project
In this task, you look at the different services that you use in this lab and inspect the application code in the Visual Studio Code IDE.

**AWS CodeCommit** is a fully managed source control service that hosts secure Git-based repositories. The service makes it easy for teams to collaborate on code in a secure and highly scalable ecosystem. CodeCommit eliminates the need to operate your own source control system or worry about scaling its infrastructure. You can use CodeCommit to securely store anything from source code to binaries, and the service works seamlessly with your existing Git tools.

**AWS CodePipeline** is a fully managed continuous delivery service that helps you automate your release pipelines for fast and reliable application and infrastructure updates. CodePipeline automates the build, test, and deploy phases of your release process every time there is a code change based on the release model that you define. This enables you to rapidly and reliably deliver features and updates. You can easily integrate CodePipeline with third-party services such as GitHub or with your own custom plugin. With CodePipeline, you pay for only what you use. There are no upfront fees or long-term commitments.

**AWS CodeBuild** is a fully managed continuous integration service that compiles source code, runs tests, and produces software packages that are ready to deploy. With CodeBuild, you don’t need to provision, manage, or scale your own build servers. CodeBuild scales continuously and processes multiple builds concurrently, so your builds are not left waiting in a queue. You can get started quickly by using prepackaged build environments, or you can create custom build environments that use your own build tools. With CodeBuild, you are charged by the minute for the compute resources that you use.

**AWS CodeDeploy** is a fully managed deployment service that automates software deployments to a variety of compute services such as Amazon Elastic Compute Cloud (Amazon EC2), AWS Fargate, AWS Lambda, and your on-premises servers. CodeDeploy makes it easier for you to rapidly release new features, helps you avoid downtime during application deployment, and handles the complexity of updating your applications. You can use CodeDeploy to automate software deployments, which eliminates the need for error-prone manual operations. The service scales to match your deployment needs.

6-10

```bash
cd app-code/backend
export LAMBDA_ROLE_ARN=$(aws iam  list-roles --query "Roles[?contains(RoleName, 'LambdaDeployment')].Arn" --output text)
sed -Ei "s|<LAMBDA_ROLE_ARN>|${LAMBDA_ROLE_ARN}|g" template.yaml
export STEP_FUNCTIONS_ROLE_ARN=$(aws iam  list-roles --query "Roles[?contains(RoleName, 'StateMachine')].Arn" --output text)
sed -Ei "s|<STEP_FUNCTIONS_ROLE_ARN>|${STEP_FUNCTIONS_ROLE_ARN}|g" template.yaml
export SAM_CODEDEPLOY_ROLE_ARN=$(aws iam  list-roles --query "Roles[?contains(RoleName, 'SAMCodeBuildLambdaDeployRole')].Arn" --output text)
sed -Ei "s|<SAM_CODEDEPLOY_ROLE_ARN>|${SAM_CODEDEPLOY_ROLE_ARN}|g"  template.yaml
cd ..
```

> [!NOTE]
> The *template.yaml* file also contains *${AWS::AccountId}*. Do not replace this value with the *AWS Account* information. The LambdaDeploymentRole is used when the AWS SAM template is automatically deployed through the CI/CD process.

## Task 2: Checking the application source code in to the CodeCommit repo

In this task, you create a repository (repo) and check in the source code. You could use any source repo (for example, GitHub), but for this lab, use CodeCommit.

11

```bash
aws codecommit create-repository --repository-name app-code
```

The terminal displays the following output:
```json
{
    "repositoryMetadata": {
        "accountId": "xxxxxxxxx",
        "repositoryId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "repositoryName": "app-code",
        "lastModifiedDate": 1603210225.175,
        "creationDate": 1603210225.175,
        "cloneUrlHttp": "https://git-codecommit.us-west-2.amazonaws.com/v1/repos/app-code",
        "cloneUrlSsh": "ssh://git-codecommit.us-west-2.amazonaws.com/v1/repos/app-code",
        "Arn": "arn:aws:codecommit:us-west-2:xxxxxxxxx:app-code"
    }
}
```
CodeCommit supports AWS Identity and Access Management (IAM) authentication, and because you are running this from a VS Code IDE running on an Amazon Elastic Compute Cloud instance, you can leverage the fact that your terminal is already pre-authenticated with valid AWS credentials via an IAM Role.

12

```bash
cd ~/environment/app-code
git init
git checkout -b main
git add .
git commit -m "Initial commit"
```
### Push the code

13

```bash
TOKEN=`curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`
echo export AWS_REGION=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region') >> ~/environment/app-code/labVariables
source ~/environment/app-code/labVariables
git remote add origin codecommit::${AWS_REGION}://app-code
```

> [!NOTE]
> This code adds your local git project to the CodeCommit repository *app-code* using the HTTPS(GRC) URL *codecommit::<AWS_REGION>://<CODECOMMIT_REPO_NAME>.*

14

```bash
pip install git-remote-codecommit
```

15

```bash
git push -u origin main
```

### Verify in CodeCommit

16-17

## Task 3: Building the CI/CD pipeline

In this task, you learn how to automate the bookmark application build process and deployment by creating a pipeline using CodePipeline.

### Introducing the AWS CDK

You use the AWS CDK as the pipeline vending mechanism in this lab. The AWS CDK is a software development framework for defining cloud infrastructure in code and provisioning it through AWS CloudFormation. You can describe your infrastructure by writing code in TypeScript, C#, Python, or Java. Your code is then synthesized into CloudFormation templates and, by using the AWS CDK CLI, can then be deployed into your AWS environment.

### Understand how AWS SAM and the AWS CDK work together

Serverless developers use the AWS SAM framework to define their applications, the AWS SAM CLI to build and deploy them, and the AWS CDK to provision any infrastructure-related resources, such as the CI/CD pipeline. All of these tools share one underlying service: CloudFormation.

18

```bash
cd ~/environment
mkdir pipeline
cd pipeline
```

19

```bash
npx aws-cdk@2.x init app --language typescript
```

### Project structure

After a few seconds, the project should have the following structure, which shows only the most relevant files and folders. Within the AWS CDK project, the main file that you interact with is **pipeline-stack.ts**.

```
app-code                        # SAM application root
├── backend                    
    ├── src                     # Lambda functions
    └──template.yaml            # SAM template
└── test                     
    ├── fake-bookmark.js         # Lambda code
    ├── simple-get.yaml  
    ├── simple-post.yaml
pipeline                    # CDK project root
    └── bin
        └── pipeline.ts         # Entry point for CDK project
    └── lib
        └── pipeline-stack.ts   # Pipeline definition
    ├── cdk.json
    ├── jest.config.js
    ├── package.json
    └── tsconfig.json
```

20-22

> [!NOTE]
> Leave other instances of *PipelineStack* as is in the **pipeline.ts** file.

### Pipeline as code

23-24

> [!NOTE]
> You will add code to this file later to build the CI/CD pipeline.

 > [!NOTE] 
 > AWS CDK automatically compiles the code whenever it needs to run your application. However, it can be useful to compile manually to check for errors and to run tests.

25

```bash
cd ~/environment/pipeline
npm run build
```

26

```bash
cdk bootstrap
```

27

```bash
cdk deploy
```


A new cloud stack has been created in your account: **bookmark-app-cicd**.

28-29

## Task 4: Creating stages

In this task, you build the artifacts bucket and add the source stage, build stage, and deploy stage to your pipeline.

### Artifacts bucket
Each CodePipeline needs an artifacts bucket, also known as an artifact store. CodePipeline uses this bucket to pass artifacts to the downstream jobs, and it’s also where AWS SAM uploads the artifacts during the build process. In this step you will specify the existing *LabServerlessBucket* bucket as CodePipeline’s artifact bucket.

30

```typescript
// lib/pipeline-stack.ts

import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as codecommit from "aws-cdk-lib/aws-codecommit";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

// Pipeline creation starts

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    // Specify the existing S3 bucket *-samserverless-* as the CodePipeline Artifact bucket
    const artifactsBucket = s3.Bucket.fromBucketName(
      this,
      "ArtifactBucket",
      "LabServerlessBucket"
    );
    
  }
}
```

31-32

```bash
cdk deploy
```

> [!NOTE]
> If you get a build error, make sure that all of the @aws-cdk dependencies in the **package.json** file have the same version number. If not, fix the version numbers, delete the node_modules, and run npm install.

33-34

### Source stage
The source stage is the first step of any CI/CD pipeline, and it represents your source code. This stage is in charge of initiating the pipeline based on new code changes (that is, Git push or pull requests). In this section of the lab, use CodeCommit as the source provider, but CodePipeline also supports Amazon S3, GitHub, and Amazon Elastic Container Registry (Amazon ECR) as source providers.

35

```typescript
// Import existing CodeCommit app-code repository
    const codeRepo = codecommit.Repository.fromRepositoryName(
      this,
      "AppRepository", // Logical name within CloudFormation
      "app-code", // Repository name
    );

    // Pipeline creation starts
    const pipeline = new codepipeline.Pipeline(this, "Pipeline", {
      artifactBucket: artifactsBucket,
      role: iam.Role.fromRoleName(
        this,
        "PipelineRole",
        "bookmark-app-cicd-codepipeline-service-role",
        { mutable: false },
      ),
    });
    // Declare source code as an artifact
    const sourceOutput = new codepipeline.Artifact();

    // Add source stage to pipeline
    pipeline.addStage({
      stageName: "Source",
      actions: [
        new codepipeline_actions.CodeCommitSourceAction({
          actionName: "CodeCommit_Source",
          repository: codeRepo,
          output: sourceOutput,
          branch: "main",
          eventRole: iam.Role.fromRoleName(
            this,
            "Eventsrole",
            "bookmark-app-cicd-events-trigger-role",
            { mutable: false },
          ),
          role: iam.Role.fromRoleName(
            this,
            "CodeCommitRole",
            "bookmark-app-cicd-codecommit-stage-role",
            { mutable: false },
          ),
        }),
      ],
    });
```

> [!NOTE]
> Because you already created the CodeCommit repository, you do not need to create a new one; rather, you need to import it using the repository name.

Also notice how a **sourceOutput** object is defined as a pipeline artifact. This is necessary for any files that you want CodePipeline to pass to downstream stages. In this case, the source code should be passed to the build stage. Additionally, you are passing pre-existing IAM roles in the source stage for the following properties. The roles are scoped to the required privileges as a best practice. You may also create them within AWS CDK as stack resources.

* **eventRole**: *bookmark-app-cicd-events-trigger-role*
	* Allows **Amazon EventBridge** event rule to automate pipeline execution in response to *git push* events.
* **role**: *bookmark-app-cicd-codecommit-stage-role*
	* Allows CodePipeline to access the source repository.

### Build stage

The build stage is where AWS SAM builds and packages your serverless application. Use CodeBuild as the build provider for your pipeline. CodeBuild is a great option because you pay for only the time when your build is running, which makes it cost-effective compared to running a dedicated build server 24 hours a day. The service is also container based, which means that you can bring your own Docker container image where your build runs or use a managed image that CodeBuild provides.


36

```typescript
// Declare build output as artifacts
  const buildOutput = new codepipeline.Artifact();

// Declare a new CodeBuild project
    const buildProject = new codebuild.PipelineProject(this, "Build", {
      environment: { buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5 },
      environmentVariables: {
        PACKAGE_BUCKET: {
          value: artifactsBucket.bucketName,
        },
      },
      role: iam.Role.fromRoleName(
        this,
        "CodeBuildProjectRole",
        "bookmark-app-cicd-codebuild-project-role",
        { mutable: false },
      ),
    });

    // Add the build stage to our pipeline
    pipeline.addStage({
      stageName: "Build",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "Build",
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
          role: iam.Role.fromRoleName(
            this,
            "CodeBuildStageRole",
            "bookmark-app-cicd-codebuild-stage-role",
            { mutable: false },
          ),
        }),
      ],
    });
```

> [!NOTE]
> Make sure that your indentation is correct after pasting the code snippet. Also notice, you are passing pre-existing IAM roles in the build stage for the following properties:

* **role** (PipelineProject): *bookmark-app-cicd-codebuild-project-role* Allows **CodeBuild** service to invoke AWS api actions in the build steps, publish build artifacts to artifact bucket and publish build logs to **Amazon CloudWatch Logs**.
* **role** (CodeBuildAction): *bookmark-app-cicd-codebuild-stage-role* Allows **CodePipeline** to invoke a build action using the **CodeBuild** project.

The roles are scoped to the required privileges as a best practice. You may also create them within AWS CDK as stack resources.

37

```bash
cdk deploy
```

38

> [!NOTE]
> Wait for the above step to complete, before proceeding to the next step. This might take a few minutes.

39-40

The build step should have failed. This is expected because you haven’t specified what commands to run during the build yet, so CodeBuild doesn’t know how to build the serverless application. To fix this issue, you need to build the **buildspec** file. A **buildspec** file is a series of commands in YAML format that CodeBuild runs to build your application. This file is placed in the root folder of an AWS SAM application, and CodeBuild automatically finds it and runs it during build time.

41-42

> [!NOTE]
> The extension of the file can be either .yml or .yaml, and CodeBuild finds it either way.

43

```yaml
# ~/environment/app-code/buildspec.yml

version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 18
    commands:
      # Install packages or any pre-reqs in this phase.
      # Upgrading SAM CLI to latest version
      - pip3 install --upgrade aws-sam-cli
      - sam --version

  build:
    commands:
      # Use Build phase to build your artifacts (compile, etc.)
      - cd backend
      - sam build

  post_build:
    commands:
      # Use Post-Build for notifications, git tags, upload artifacts to S3
      - cd ..
      - sam package --template backend/template.yaml --s3-bucket $PACKAGE_BUCKET --output-template-file packaged.yaml

artifacts:
  discard-paths: yes
  files:
    # List of local artifacts that will be passed down the pipeline
    - packaged.yaml
```

Examine the commands in the *buildspec.yml* file:

* The sam build command is used to build the AWS SAM app.
* The sam build command iterates through the functions in the application, looking for the manifest file (such as *requirements.txt* or *package.json*) that contains the dependencies and automatically creates deployment artifacts.
* The sam package command packages an AWS SAM application.
* The sam package command creates a ZIP file of your code and dependencies, and uploads it to Amazon S3.
* The sam package command then returns a copy of your AWS SAM template, replacing references to local artifacts with the Amazon S3 location where the command uploaded the artifacts.

44

```bash
cd ~/environment/app-code
git add .
git commit -m "Added buildspec.yml"
git push
```

### Deploy stage

The deploy stage is where your AWS SAM application and all of its resources are created in an AWS account. The most common way to do this is by using CloudFormation ChangeSets to deploy. This means that this stage has two actions: CreateChangeSet and Deploy.

45

```typescript
// Deploy stage
    pipeline.addStage({
      stageName: "Dev",
      actions: [
        new codepipeline_actions.CloudFormationCreateReplaceChangeSetAction({
          actionName: "CreateChangeSet",
          templatePath: buildOutput.atPath("packaged.yaml"),
          stackName: "bookmark-app",
          adminPermissions: true,
          changeSetName: "bookmark-app-dev-changeset",
          runOrder: 1,
          deploymentRole: iam.Role.fromRoleName(
            this,
            "CPCfnDeployRole",
            "bookmark-app-cicd-cfn-stack-role",
            { mutable: false },
          ),
          role: iam.Role.fromRoleName(
            this,
            "CfnStackCrtChgSetRole",
            "bookmark-app-cicd-cfndeploy-changeset-role",
            { mutable: false },
          ),
        }),
        new codepipeline_actions.CloudFormationExecuteChangeSetAction({
          actionName: "Deploy",
          stackName: "bookmark-app",
          changeSetName: "bookmark-app-dev-changeset",
          runOrder: 2,
          role: iam.Role.fromRoleName(
            this,
            "CfnStackImplChgSetRole",
            "bookmark-app-cicd-cfndeploy-changeset-role",
            { mutable: false },
          ),
        }),
      ],
    });
```

Also notice, you are passing pre-existing IAM roles in the deploy stage for the following properties:

* **deploymentRole**: *bookmark-app-cicd-cfn-stack-role* Allows CloudFormation to provision the resources specified in the packaged AWS Serveless Application Model template file.
* **role**: *bookmark-app-cicd-codebuild-project-role* Allows CodePipeline service to deploy **bookmark-app** CloudFormation stack using CloudFormation stack changesets and set the stack role as *bookmark-app-cicd-cfn-stack-role*
The roles are scoped to the required privileges as a best practice. You may also create them within AWS CDK as stack resources.

> [!NOTE] 
> Open the context (right-click) menu on this pipeline-stack.ts link and choose the option to save the complete version of pipeline-stack.ts file to your computer for reference.

46

```bash
cd ~/environment/pipeline
cdk deploy
```

> [!NOTE]
> Wait for the above step to complete, before proceeding to the next step. This might take a few minutes.

47

> [!NOTE]
> Make certain you are in the correct region.

50


Congratulations! You have created a CI/CD pipeline for a serverless application.

> [!NOTE]
> It takes several minutes for the pipeline to run.

51-52

This tab lists all of the resources created that are defined in the AWS SAM template.

## Task 5: Updating a Lambda function to test the automated deployment

In this task, you start by using Artillery, which is a load testing and functionality tool. You run the **simple-post.yaml** file from the **test** folder under **app-code** in VS Code. This adds bookmarks by invoking the **createBookmark** function.


53-54

> [!NOTE]
> The VS Code IDE contains two **test** folders. Expand the **test** folder that is a subfolder of **app-code** and not the test folder that is a subfolder of the **pipeline** folder.

55-56

```bash
cd ~/environment/app-code/test
echo export API_GATEWAY_ID=$(aws apigateway get-rest-apis --query 'items[?name==`Bookmark App`].id' --output text) >> ~/environment/app-code/labVariables
source ~/environment/app-code/labVariables
echo export API_GATEWAY_URL=https://${API_GATEWAY_ID}.execute-api.${AWS_REGION}.amazonaws.com/dev >> ~/environment/app-code/labVariables
source ~/environment/app-code/labVariables
sed -Ei "s|<API_GATEWAY_URL>|${API_GATEWAY_URL}|g" simple-post.yaml
cd ..
```
> [!NOTE]
> The script is running the AWS CLI command to get the API Gateway ID and the AWS region to construct the API Gateway URL. This URL is then substituted in the placeholder <API_GATEWAY_URL> in the **simple-post.yaml** file.

57

```bash
cd ~/environment/app-code/test && artillery run simple-post.yaml
```

The **simple-post.yaml** script runs for 30 seconds, adding data through the API and then invoking the **createBookmark** function.

58-62

```bash
source ~/environment/app-code/labVariables
echo export ID=$(aws dynamodb scan --table-name bookmarksTable --query Items[0].id --output text) >> ~/environment/app-code/labVariables
source ~/environment/app-code/labVariables
curl ${API_GATEWAY_URL}/bookmarks/${ID}
```

> [!NOTE]
> The *API_GATEWAY_URL* value has been fetched in the above steps and stored in the *labVariables* file. The *labVariables* file contains all of the values fetched so far using the AWS CLI commands.

> [!NOTE]
> The bookmark details are retrieved for the provided ID.

Now, update the **getBookmark** Lambda function and observe how the function is automatically deployed with the pipeline.

63-65

```typescript
return {
    statusCode: 200,
    headers: {"Access-Control-Allow-Origin": '*'},
    body: JSON.stringify([('Successfully retrieved bookmark '),results.Item])
  };
```

66

```bash
cd ~/environment/app-code
git add .
git commit -m "updated getBookmark function"
git push
```

The pipeline should automatically begin the build process and deploy the AWS SAM template with the changes.

67

Make sure that the deployment is completed successfully before moving on to the next step.

68-69

View the function code to review the updates that have been deployed.

70

```bash
source ~/environment/app-code/labVariables
curl ${API_GATEWAY_URL}/bookmarks/${ID}
```

> [!NOTE]
> The bookmark details are retrieved for the provided bookmark ID, along with the updated text **Successfully retrieved bookmark**.

The changes that you made were automatically deployed using the CI/CD pipeline.

## Task 6: Understanding canary deployments and how to implement them

In this task, you learn about canary deployments and how they play an important role in rolling out changes to production. A canary deployment is a technique that reduces the risk of deploying a new version of an application by slowly rolling out the changes to a small subset of users before rolling the new version out to the entire customer base. Using blue/green and canary deployments is well established as a best practice for reducing the risk of software deployments. In traditional applications, you slowly and incrementally update the servers in your fleet while simultaneously verifying application health. However, these concepts don’t map directly to a serverless world. You can’t incrementally deploy your software across a fleet of servers when there are no servers. However, a couple of services and features make this possible.

### Lambda versions and aliases

Lambda allows you to publish multiple versions of the same function. Each version has its own code and associated dependencies, and its own function settings (such as memory allocation, timeout, and environment variables). You can then refer to a given version by using a Lambda alias. An alias is a name that can be pointed to a given version of a Lambda function.

71-73

```yaml
## Canary deployment configuration
      AutoPublishAlias: live
      DeploymentPreference:
        Type: Canary10Percent5Minutes
        Role: !Ref CodeDeployDeploymentRole
```

> [!NOTE]
> The indentation for the code snippet above should appear as follows when pasted into the **template.yaml** file:

```yaml
getBookmark:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: getBookmark
      Description: !Sub
        - ${ResourceName} Function 
        - ResourceName: getBookmark
      CodeUri: src/getBookmark
      Environment:
        Variables:
          TABLE_NAME: !Ref bookmarksTable
          TABLE_ARN: !GetAtt bookmarksTable.Arn
      Role: !Ref LambdaDeploymentRole
## Canary deployment configuration
      AutoPublishAlias: live
      DeploymentPreference:
        Type: Canary10Percent5Minutes
        Role: !Ref CodeDeployDeploymentRole
      Events:
        apiGET:
          Type: Api
          Properties:
            Path: /bookmarks/{id}
            Method: GET
            RestApiId: !Ref api
    Metadata:
      FinTag: getBookmark
```

### Deployment preference types
Use the *Canary10Percent5Minutes* strategy for this lab, which means that traffic is shifted in two increments. In the first increment, only 10 percent of the traffic is shifted to the new Lambda version, and after 5 minutes, the remaining 90 percent is shifted. You can choose other deployment strategies in CodeDeploy, such as the following:

* Canary10Percent30Minutes
* Canary10Percent5Minutes
* Canary10Percent10Minutes
* Canary10Percent15Minutes
* Linear10PercentEvery10Minutes
* Linear10PercentEvery1Minute
* Linear10PercentEvery2Minutes
* Linear10PercentEvery3Minutes
* AllAtOnce

The *Linear* strategy means that traffic is shifted in equal increments with an equal time interval between each increment.

74

```bash
cd ~/environment/app-code/backend
sam validate
```

If the template is correct, a line appears that says the **template.yaml** file is a valid AWS SAM template. If an error appears, then you likely have an indentation issue on the .yaml file.

> [!NOTE]
> SAM validator may show a message such as: *“Feature ‘deployment_preference_condition_fix’ not available in Feature Toggle Config.”* You can safely ignore this message for now as the missing feature does not impact our current usage of SAM.

75

```bash
cd ~/environment/app-code
git add .
git commit -m "Canary deployments with SAM"
git push
```

Canary deployments are considerably more successful if the code is monitored during the deployment. You can configure CodeDeploy to automatically roll back the deployment if a specified Amazon CloudWatch metric has breached the alarm threshold. Common metrics to monitor are Lambda invocation errors or invocation duration (latency).


76

```yaml
##CloudWatch Alarm Canary Deployment
  CanaryErrorsAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmDescription: Lambda function canary errors
      ComparisonOperator: GreaterThanThreshold
      EvaluationPeriods: 2
      MetricName: Errors
      Namespace: AWS/Lambda
      Period: 60
      Statistic: Sum
      Threshold: 0
      Dimensions:
        - Name: Resource
          Value: "getBookmark:live"
        - Name: FunctionName
          Value: !Ref getBookmark
        - Name: ExecutedVersion
          Value: !GetAtt getBookmark.Version.Version
```

> [!NOTE]
> It is important to maintain the indentation when inserting the new code. The indentation should look like the following under the getBookmark function definition:

```yaml
Metadata:
      FinTag: getBookmark
      
## CloudWatch Alarm Canary Deployment
  CanaryErrorsAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmDescription: Lambda function canary errors
      ComparisonOperator: GreaterThanThreshold
      EvaluationPeriods: 2
      MetricName: Errors
      Namespace: AWS/Lambda
      Period: 60
      Statistic: Sum
      Threshold: 0
      Dimensions:
        - Name: Resource
          Value: "getBookmark:live"
        - Name: FunctionName
          Value: !Ref getBookmark
        - Name: ExecutedVersion
          Value: !GetAtt getBookmark.Version.Version
    
  updateBookmark:
    Type: AWS::Serverless::Function
```

77

```yaml
## Alarm preference
        Alarms:
          - !Ref CanaryErrorsAlarm
```
> [!NOTE]
> It is important to maintain the indentation when inserting the new lines. The indentation should align with the DeploymentPreference section as follows:


```yaml
  getBookmark:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: getBookmark
      Description: !Sub
        - ${ResourceName} Function 
        - ResourceName: getBookmark
      CodeUri: src/getBookmark
      Environment:
        Variables:
          TABLE_NAME: !Ref bookmarksTable
          TABLE_ARN: !GetAtt bookmarksTable.Arn
      Role: !Ref LambdaDeploymentRole
## Canary deployment configuration 
      AutoPublishAlias: live
      DeploymentPreference:
        Type: Canary10Percent5Minutes
        Role: !Ref CodeDeployDeploymentRole
## Alarm preference
        Alarms:
          - !Ref CanaryErrorsAlarm
      Events:
        apiGET:
          Type: Api
          Properties:
            Path: /bookmarks/{id}
            Method: GET
            RestApiId: !Ref api
    Metadata:
      FinTag: getBookmark
```

78

```
uri: !Sub arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${getBookmark.Arn}/invocations
```

79

```
uri: !Sub arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${getBookmark.Arn}:live/invocations
```

> [!NOTE]
> This update ensures that API Gateway can correctly return the version of the **getBookmark** Lambda function that is being invoked.

> [!NOTE]
> Open the context (right-click) menu on this template.yaml link and choose the option to save the complete version of template.yaml file to your computer for reference.

80

```bash
cd ~/environment/app-code/backend
sam validate
```
If the template is correct, a line appears that says the **template.yaml** file is a valid AWS SAM template. If an error appears, then you likely have an indentation issue on the .yaml file.

81-82

```typescript
return {
    statusCode: 200,
    headers: {"Access-Control-Allow-Origin": '*'},
    body: JSON.stringify(['Successfully retrieved bookmark using the new version' , results.Item])
  };
```

83

```bash
cd ~/environment/app-code
git add .
git commit -m "Added CloudWatch alarm to monitor the canary"
git push
```

84-87

```bash
source ~/environment/app-code/labVariables
counter=1
while [ $counter -le 120 ]
do
    curl ${API_GATEWAY_URL}/bookmarks/${ID}
    sleep 1
    ((counter++))
    printf "\n"
done
```

> [!NOTE]
> The difference in the return statement value during the deployment process indicates that the different versions of the Lambda function are being invoked.

Wait 5 minutes until the remaining traffic is shifted to the new version. You can verify this shift by checking the **Deployment** details in the CodeDeploy console.

88

### Rollbacks

Monitoring the health of your canary allows CodeDeploy to make a decision about whether a rollback is needed or not. If any of the specified CloudWatch alarms gets to ALARM status, CodeDeploy rolls back the deployment automatically. Next, you break the Lambda function on purpose so that the **CanaryErrorsAlarm** alarm is invoked during deployment.

89-90

```typescript
export const handler = async message => {
  throw new Error("this will cause a deployment rollback");
}
```

91

```bash
cd ~/environment/app-code
git add .
git commit -m "Breaking the lambda function on purpose"
git push
```
In the CodePipeline console, wait for the pipeline to reach the deployment phase (Deploy). It should turn blue when it begins. While the deployment is running, you need to generate traffic to the new Lambda function to make it fail and invoke the CloudWatch alarm. In a real production environment, your users would likely generate organic traffic to the canary function, so you might not need to do this.

92

```bash
source ~/environment/app-code/labVariables
counter=1
while [ $counter -le 180 ]
do
    curl ${API_GATEWAY_URL}/bookmarks/${ID}
    sleep 1
    ((counter++))
    printf "\n"
done
```
