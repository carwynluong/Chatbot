const { DynamoDBClient } = require('./backend/node_modules/@aws-sdk/client-dynamodb');
const { CreateTableCommand, ListTablesCommand, DescribeTableCommand } = require('./backend/node_modules/@aws-sdk/client-dynamodb');
require('./backend/node_modules/dotenv/lib/main.js').config({ path: './backend/.env' });

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

// Table definitions
const tables = [
    {
        TableName: process.env.USER_TABLE_NAME || 'Users',
        KeySchema: [
            {
                AttributeName: 'id',
                KeyType: 'HASH' // Partition key
            }
        ],
        AttributeDefinitions: [
            {
                AttributeName: 'id',
                AttributeType: 'S'
            },
            {
                AttributeName: 'email',
                AttributeType: 'S'
            }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'EmailIndex',
                KeySchema: [
                    {
                        AttributeName: 'email',
                        KeyType: 'HASH'
                    }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                },
                BillingMode: 'PAY_PER_REQUEST'
            }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    },
    {
        TableName: process.env.CHAT_TABLE_NAME || 'ChatHistory',
        KeySchema: [
            {
                AttributeName: 'userId',
                KeyType: 'HASH' // Partition key
            },
            {
                AttributeName: 'sessionId',
                KeyType: 'RANGE' // Sort key
            }
        ],
        AttributeDefinitions: [
            {
                AttributeName: 'userId',
                AttributeType: 'S'
            },
            {
                AttributeName: 'sessionId',
                AttributeType: 'S'
            },
            {
                AttributeName: 'timestamp',
                AttributeType: 'N'
            }
        ],
        LocalSecondaryIndexes: [
            {
                IndexName: 'TimestampIndex',
                KeySchema: [
                    {
                        AttributeName: 'userId',
                        KeyType: 'HASH'
                    },
                    {
                        AttributeName: 'timestamp',
                        KeyType: 'RANGE'
                    }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                }
            }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    },
    {
        TableName: process.env.DOCUMENT_TABLE_NAME || 'DocumentEmbeddings',
        KeySchema: [
            {
                AttributeName: 'documentId',
                KeyType: 'HASH' // Partition key
            }
        ],
        AttributeDefinitions: [
            {
                AttributeName: 'documentId',
                AttributeType: 'S'
            },
            {
                AttributeName: 'userId',
                AttributeType: 'S'
            },
            {
                AttributeName: 'uploadedAt',
                AttributeType: 'N'
            }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'UserDocumentsIndex',
                KeySchema: [
                    {
                        AttributeName: 'userId',
                        KeyType: 'HASH'
                    },
                    {
                        AttributeName: 'uploadedAt',
                        KeyType: 'RANGE'
                    }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                },
                BillingMode: 'PAY_PER_REQUEST'
            }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    }
];

// Function to check if table exists
async function tableExists(tableName) {
    try {
        const command = new DescribeTableCommand({ TableName: tableName });
        const result = await dynamoClient.send(command);
        return result.Table.TableStatus === 'ACTIVE';
    } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
            return false;
        }
        throw error;
    }
}

// Function to create table
async function createTable(tableConfig) {
    try {
        console.log(`Creating table: ${tableConfig.TableName}...`);
        
        const command = new CreateTableCommand(tableConfig);
        const result = await dynamoClient.send(command);
        
        console.log(`✅ Table ${tableConfig.TableName} created successfully!`);
        console.log(`   Table ARN: ${result.TableDescription.TableArn}`);
        
        return result;
    } catch (error) {
        console.error(`❌ Error creating table ${tableConfig.TableName}:`, error.message);
        throw error;
    }
}

// Function to wait for table to become active
async function waitForTable(tableName, maxWaitTime = 300000) { // 5 minutes max
    console.log(`⏳ Waiting for table ${tableName} to become active...`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
        try {
            const command = new DescribeTableCommand({ TableName: tableName });
            const result = await dynamoClient.send(command);
            
            if (result.Table.TableStatus === 'ACTIVE') {
                console.log(`✅ Table ${tableName} is now active!`);
                return true;
            }
            
            console.log(`   Table ${tableName} status: ${result.Table.TableStatus}`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            
        } catch (error) {
            console.error(`Error checking table status: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    throw new Error(`Table ${tableName} did not become active within ${maxWaitTime/1000} seconds`);
}

// Main function
async function createAllTables() {
    console.log('🚀 Starting DynamoDB table creation process...\n');
    
    // Verify AWS credentials
    console.log('📋 Configuration:');
    console.log(`   AWS Region: ${process.env.AWS_REGION}`);
    console.log(`   AWS Access Key ID: ${process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...' : 'Not set'}`);
    console.log(`   Tables to create: ${tables.map(t => t.TableName).join(', ')}\n`);
    
    try {
        // List existing tables
        const listCommand = new ListTablesCommand({});
        const existingTables = await dynamoClient.send(listCommand);
        console.log('📊 Existing tables:', existingTables.TableNames || 'None\n');
        
        // Create tables
        for (const tableConfig of tables) {
            const exists = await tableExists(tableConfig.TableName);
            
            if (exists) {
                console.log(`⚠️  Table ${tableConfig.TableName} already exists, skipping...`);
            } else {
                await createTable(tableConfig);
                await waitForTable(tableConfig.TableName);
            }
            
            console.log(''); // Add spacing
        }
        
        console.log('🎉 All DynamoDB tables created successfully!');
        console.log('\n📝 Table Summary:');
        console.log('   • Users: Store user accounts and authentication info');
        console.log('   • ChatHistory: Store chat conversations and sessions');
        console.log('   • DocumentEmbeddings: Store document metadata and processing status');
        console.log('\n💡 Note: Vector embeddings are stored in Pinecone, not DynamoDB');
        console.log('🔗 You can now start your application with: npm run dev');
        
    } catch (error) {
        console.error('❌ Failed to create DynamoDB tables:', error.message);
        console.error('\n🔍 Troubleshooting tips:');
        console.error('   1. Check your AWS credentials in .env file');
        console.error('   2. Ensure your AWS account has DynamoDB permissions');
        console.error('   3. Verify AWS region is correct');
        console.error('   4. Check AWS account billing/limits');
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    createAllTables();
}

module.exports = { createAllTables, tableExists };