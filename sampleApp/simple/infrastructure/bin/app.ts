#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SimpleVulnerableDemoStack } from '../lib/simple-stack';

const app = new cdk.App();

new SimpleVulnerableDemoStack(app, 'SimpleVulnerableDemoStack', {
  description: 'Simplified educational vulnerable web application for AWS Security Agent demo',
});

app.synth();
