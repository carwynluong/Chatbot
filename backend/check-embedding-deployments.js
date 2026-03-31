const https = require('https');
require('dotenv').config();

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;

async function checkEmbeddingDeployments() {
    console.log('🔍 Checking Azure OpenAI Embedding Deployments...\n');
    console.log('Endpoint:', endpoint);
    console.log('Current embedding deployment from .env:', process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME);
    console.log('\n' + '='.repeat(60) + '\n');

    // Test common embedding deployment names
    const embeddingModels = [
        'text-embedding-ada-002',
        'text-embedding-3-small', 
        'text-embedding-3-large',
        'text-embedding-002',
        'embedding-ada-002',
        'ada-002',
        'text-ada-002',
        'embedding-3-small',
        'embedding-3-large',
        'ada-embedding',
        'text-embedding',
        'embeddings'
    ]

    let foundDeployments = []

    for (const model of embeddingModels) {
        try {
            const result = await testEmbeddingDeployment(model)
            if (result.exists) {
                foundDeployments.push(model)
                console.log(`${model}: ✅ EXISTS (Status: ${result.status})`)
            } else {
                console.log(`${model}: ❌ NOT FOUND (Status: ${result.status})`)
            }
        } catch (error) {
            console.log(`${model}: ❌ ERROR - ${error.message}`)
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n' + '='.repeat(60))
    if (foundDeployments.length > 0) {
        console.log('🎉 FOUND WORKING EMBEDDING DEPLOYMENTS:')
        foundDeployments.forEach(name => console.log(`  ✅ ${name}`))
        console.log('\n💡 Update your .env file with one of these deployment names:')
        console.log(`AZURE_EMBEDDING_DEPLOYMENT_NAME=${foundDeployments[0]}`)
    } else {
        console.log('❌ NO EMBEDDING DEPLOYMENTS FOUND')
        console.log('📋 You need to deploy an embedding model in Azure AI Foundry:')
        console.log('   1. Go to https://ai.azure.com')
        console.log('   2. Select your "carwyngenai" project')
        console.log('   3. Go to Models → Deploy → Deploy base model')
        console.log('   4. Search for "text-embedding" models')
        console.log('   5. Deploy "text-embedding-3-small" is recommended')
        console.log('   6. Copy the exact deployment name to your .env')
    }
}

async function testEmbeddingDeployment(deploymentName) {
    const url = `${endpoint}openai/deployments/${deploymentName}/embeddings?api-version=2024-06-01`;
    
    return new Promise((resolve) => {
        const data = JSON.stringify({
            input: "test text for embedding"
        });

        const options = {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            },
        };

        const req = https.request(url, options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                // If status is not 404, deployment likely exists
                // We might get 400 or other errors, but 404 means definitely not found
                resolve({
                    name: deploymentName,
                    exists: res.statusCode !== 404, 
                    status: res.statusCode,
                    response: responseData
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

        req.write(data);
        req.end();
    });
}

checkEmbeddingDeployments().catch(console.error);