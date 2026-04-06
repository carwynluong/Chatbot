const { Pinecone } = require('@pinecone-database/pinecone')
require('dotenv').config({ path: '../.env' })

const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME

async function checkAndFixPineconeIndex() {
    try {
        console.log('🔍 Checking Pinecone index configuration...')
        
        const pinecone = new Pinecone({
            apiKey: PINECONE_API_KEY
        })

        // List existing indexes
        const indexes = await pinecone.listIndexes()
        console.log('📊 Current indexes:', indexes.indexes?.map(i => ({ name: i.name, dimension: i.dimension })))

        const existingIndex = indexes.indexes?.find(index => index.name === PINECONE_INDEX_NAME)

        if (existingIndex) {
            console.log(`📋 Index "${PINECONE_INDEX_NAME}" found:`)
            console.log(`   Dimension: ${existingIndex.dimension}`)
            console.log(`   Metric: ${existingIndex.metric}`)
            console.log(`   Cloud: ${existingIndex.host}`)

            if (existingIndex.dimension !== 1536) {
                console.log(`⚠️  PROBLEM: Index has ${existingIndex.dimension} dimensions, but we need 1536`)
                console.log('\n🔧 SOLUTION OPTIONS:')
                console.log('   1. Delete and recreate index with correct dimension (WILL LOSE ALL DATA)')
                console.log('   2. Change embedding model to match existing dimension')
                
                console.log('\n❓ Do you want to recreate the index? (This will DELETE all existing data)')
                console.log('   Type "yes" to continue or any other key to abort')
                
                // In a real scenario, you'd use readline for user input
                // For now, let's just log the commands needed
                console.log('\n🔧 To fix manually, run these commands:')
                console.log(`   1. Delete index: pinecone.deleteIndex("${PINECONE_INDEX_NAME}")`)
                console.log(`   2. Create new: pinecone.createIndex({ name: "${PINECONE_INDEX_NAME}", dimension: 1536, metric: "cosine" })`)
                
                return false
            } else {
                console.log('✅ Index dimension is correct (1536)')
                return true
            }
        } else {
            console.log(`📋 Index "${PINECONE_INDEX_NAME}" not found. Creating new index...`)
            await createNewIndex(pinecone)
            return true
        }

    } catch (error) {
        console.error('❌ Error checking Pinecone:', error)
        return false
    }
}

async function createNewIndex(pinecone) {
    try {
        console.log('🔨 Creating new Pinecone index...')
        
        await pinecone.createIndex({
            name: PINECONE_INDEX_NAME,
            dimension: 1536,
            metric: 'cosine',
            spec: {
                serverless: {
                    cloud: 'aws',
                    region: 'us-east-1'
                }
            }
        })
        
        console.log('✅ Successfully created new index with 1536 dimensions')
        
        // Wait for index to be ready
        console.log('⏳ Waiting for index to be ready...')
        await new Promise(resolve => setTimeout(resolve, 60000)) // Wait 1 minute
        
    } catch (error) {
        console.error('❌ Error creating index:', error)
        throw error
    }
}

async function deleteAndRecreateIndex() {
    try {
        const pinecone = new Pinecone({
            apiKey: PINECONE_API_KEY
        })

        console.log('🗑️ Deleting existing index...')
        await pinecone.deleteIndex(PINECONE_INDEX_NAME)
        
        console.log('⏳ Waiting for deletion to complete...')
        await new Promise(resolve => setTimeout(resolve, 30000)) // Wait 30 seconds
        
        await createNewIndex(pinecone)
        
        console.log('✅ Index successfully recreated with correct dimensions')
        
    } catch (error) {
        console.error('❌ Error recreating index:', error)
        throw error
    }
}

// Export functions for manual use
module.exports = {
    checkAndFixPineconeIndex,
    deleteAndRecreateIndex,
    createNewIndex
}

// Run check when script is executed directly
if (require.main === module) {
    checkAndFixPineconeIndex().then(() => {
        console.log('✅ Check completed')
        process.exit(0)
    }).catch(error => {
        console.error('❌ Script failed:', error)
        process.exit(1)
    })
}