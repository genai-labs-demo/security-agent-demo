#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VulnerableDemoStack } from '../lib/vulnerable-demo-stack';

const app = new cdk.App();

new VulnerableDemoStack(app, 'VulnerableDemoStack', {
  description: 'Educational vulnerable web application for AWS Security Agent demo',
});

app.synth();
