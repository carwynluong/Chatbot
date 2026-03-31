const https = require('https');
require('dotenv').config();

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

// Base URL for checking deployments
const baseApiUrl = endpoint.replace(/\/$/, '') + '/openai/deployments';

async function checkDeployment(deploymentName) {
    const url = `${baseApiUrl}/${deploymentName}/chat/completions?api-version=${apiVersion}`;
    
    return new Promise((resolve) => {
        const options = {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
            },
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                // If status is not 404, deployment exists
                resolve({
                    name: deploymentName,
                    exists: res.statusCode !== 404,
                    status: res.statusCode,
                    response: data
                });
            });
        });

        req.on('error', (error) => {
            resolve({
                name: deploymentName,
                exists: false,
                status: 'error',
                error: error.message
            });
        });

        // Send minimal test payload
        req.write(JSON.stringify({
            messages: [{ role: "user", content: "test" }],
            max_tokens: 1
        }));
        
        req.end();
    });
}

async function listDeployments() {
    console.log('🔍 Checking Azure OpenAI Deployments...\n');
    console.log('Endpoint:', endpoint);
    console.log('API Version:', apiVersion);
    console.log('Current deployment name from .env:', process.env.AZURE_LLM_DEPLOYMENT_NAME);
    console.log('\n' + '='.repeat(50) + '\n');

    // Test current deployment from .env
    const currentDeployment = process.env.AZURE_LLM_DEPLOYMENT_NAME;
    if (currentDeployment) {
        const result = await checkDeployment(currentDeployment);
        console.log(`Current deployment (${currentDeployment}):`, 
            result.exists ? '✅ EXISTS' : '❌ NOT FOUND',
            `(Status: ${result.status})`
        );
        
        if (!result.exists) {
            console.log('Response:', result.response);
        }
    }

    console.log('\n📋 Testing common deployment names...\n');

    // Test common GPT deployment names
    const testDeployments = [
        'gpt-4',
        'gpt-4-turbo',
        'gpt-4-1',
        'gpt-4.1',
        'gpt-4-0125-preview',
        'gpt-4-turbo-preview',
        'gpt-35-turbo',
        'gpt-3.5-turbo'
    ];

    for (const deployment of testDeployments) {
        const result = await checkDeployment(deployment);
        console.log(`${deployment}:`, 
            result.exists ? '✅ EXISTS' : '❌ NOT FOUND',
            `(Status: ${result.status})`
        );
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(50));
    console.log('💡 If deployments exist but show as NOT FOUND, check your API key permissions');
    console.log('💡 Go to https://ai.azure.com → Select carwyngenai project → Deployments to see actual names');
}

listDeployments().catch(console.error);