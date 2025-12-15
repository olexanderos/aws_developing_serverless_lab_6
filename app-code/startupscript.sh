#!/bin/bash

set -o errexit pipefail

# Task 1: validate and install package
sam --version

TOKEN=`curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`
export AWS_REGION=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region')
test -n "$AWS_REGION" && echo AWS_REGION is "$AWS_REGION" || echo AWS_REGION is not set
aws configure set default.region ${AWS_REGION}
aws configure get default.region

# Task 2: install artillery and faker modules
cd /home/ec2-user/environment/app-code/test
sudo npm install artillery -g
npm install faker@5.5.3