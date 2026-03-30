const { Pinecone } = require('./backend/node_modules/@pinecone-database/pinecone');
require('./backend/node_modules/dotenv/lib/main.js').config({ path: './backend/.env' });

async function testPinecone() {
    try {
        console.log('🔍 Testing Pinecone connection...');
        console.log(`📍 API Key: ${process.env.PINECONE_API_KEY ? process.env.PINECONE_API_KEY.substring(0, 8) + '...' : 'Not found'}`);
        console.log(`📊 Index: ${process.env.PINECONE_INDEX_NAME}`);
        
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        
        // List indexes
        console.log('⏳ Listing indexes...');
        const indexes = await pinecone.listIndexes();
        console.log('✅ Pinecone connection successful!');
        console.log(`📈 Found ${indexes.indexes?.length || 0} indexes:`);
        
        indexes.indexes?.forEach(index => {
            console.log(`   - ${index.name} (${index.dimension} dimensions, ${index.metric} metric)`);
        });
        
        // Test specific index
        const targetIndex = process.env.PINECONE_INDEX_NAME;
        if (targetIndex) {
            console.log(`\n🎯 Testing index: ${targetIndex}`);
            const index = pinecone.index(targetIndex);
            
            const stats = await index.describeIndexStats();
            console.log(`✅ Index stats:`);
            console.log(`   - Total vectors: ${stats.totalVectorCount || 0}`);
            console.log(`   - Dimensions: ${stats.dimension || 'N/A'}`);
            
            if (stats.totalVectorCount && stats.totalVectorCount > 0) {
                console.log(`\n🔍 Sample query test...`);
                // Create a sample query vector (all zeros for testing)
                const sampleVector = new Array(stats.dimension).fill(0);
                const queryResult = await index.query({
                    vector: sampleVector,
                    topK: 3,
                    includeMetadata: true
                });
                console.log(`✅ Query successful! Found ${queryResult.matches?.length || 0} matches`);
                queryResult.matches?.forEach((match, i) => {
                    console.log(`   ${i+1}. Score: ${match.score?.toFixed(4)}, ID: ${match.id}`);
                });
            } else {
                console.log('ℹ️  Index is empty - no vectors stored yet');
            }
        }
        
    } catch (error) {
        console.error('❌ Pinecone error:', error.message);
        
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            console.log('💡 Check your PINECONE_API_KEY');
        } else if (error.message.includes('404')) {
            console.log('💡 Index might not exist or incorrect name');
        }
    }
}

testPinecone().catch(console.error);