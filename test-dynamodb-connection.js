const { DynamoDBClient } = require('./backend/node_modules/@aws-sdk/client-dynamodb');
const { ListTablesCommand } = require('./backend/node_modules/@aws-sdk/client-dynamodb');
require('./backend/node_modules/dotenv/lib/main.js').config({ path: './backend/.env' });

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

async function testDynamoDBConnection() {
    console.log('🔍 Testing DynamoDB connection...\n');
    
    try {
        console.log('📋 AWS Configuration:');
        console.log(`   Region: ${process.env.AWS_REGION}`);
        console.log(`   Access Key: ${process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...' : 'Not set'}\n`);
        
        // List all tables
        const command = new ListTablesCommand({});
        const result = await dynamoClient.send(command);
        
        console.log('✅ DynamoDB connection successful!');
        console.log(`📊 Found ${result.TableNames.length} tables:`);
        
        result.TableNames.forEach(tableName => {
            console.log(`   • ${tableName}`);
        });
        
        console.log('\n🎯 Required tables status:');
        const requiredTables = ['Users', 'ChatHistory', 'DocumentEmbeddings'];
        
        requiredTables.forEach(table => {
            const exists = result.TableNames.includes(table);
            console.log(`   ${exists ? '✅' : '❌'} ${table}`);
        });
        
        const allTablesExist = requiredTables.every(table => result.TableNames.includes(table));
        
        if (allTablesExist) {
            console.log('\n🚀 All required DynamoDB tables are ready!');
            console.log('💡 Your backend can now connect to DynamoDB successfully.');
        } else {
            console.log('\n⚠️  Some required tables are missing. Run create-dynamodb-tables.js again.');
        }
        
    } catch (error) {
        console.error('❌ DynamoDB connection failed:', error.message);
        console.error('\n🔍 Possible issues:');
        console.error('   1. Invalid AWS credentials');
        console.error('   2. Incorrect AWS region');
        console.error('   3. Insufficient permissions');
        console.error('   4. Network connectivity issues');
    }
}

// Run the test
testDynamoDBConnection();