#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkLambdaStack } from '../lib/cdk-lambda-stack';
//import { DefaultStackSynthesizer } from 'aws-cdk-lib';

const app = new cdk.App();
console.log(process.env.CDK_DEFAULT_REGION)
new CdkLambdaStack(app, 'CdkLambdaStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  // synthesizer: new DefaultStackSynthesizer({
  //   qualifier: 'warrior',
  //   fileAssetsBucketName: 'warrior', // more likely e.g. 'cdk-${Qualifier}-assets-${AWS::AccountId}-${AWS::Region}'
  //   bucketPrefix: '',
  // }),

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});