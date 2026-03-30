const API_BASE = 'http://localhost:3000/api';

// Test S3 endpoints using built-in fetch
async function testS3API() {
    console.log('🧪 Testing S3 API endpoints...\n');
    
    try {
        // 1. Health check
        console.log('1️⃣ Testing health endpoint...');
        const health = await fetch(`${API_BASE.replace('/api', '')}/health`);
        const healthText = await health.text();
        console.log('✅ Health check:', healthText);
        
        // 2. List files (should work without auth for testing)
        console.log('\n2️⃣ Testing list files endpoint...');
        try {
            const listResponse = await fetch(`${API_BASE}/uploads/list`);
            if (listResponse.ok) {
                const listData = await listResponse.json();
                console.log('✅ List files successful:', listData);
            } else {
                const errorData = await listResponse.text();
                console.log('❌ List files failed:', errorData);
            }
        } catch (listError) {
            console.log('❌ List files failed:', listError.message);
        }
        
        // 3. Test S3 URL generation
        console.log('\n3️⃣ Testing S3 URL generation...');
        try {
            const urlResponse = await fetch(`${API_BASE}/uploads/url/test-file.pdf`);
            if (urlResponse.ok) {
                const urlData = await urlResponse.json();
                console.log('✅ S3 URL generation:', urlData);
            } else {
                const errorData = await urlResponse.text();
                console.log('❌ S3 URL generation failed:', errorData);
            }
        } catch (urlError) {
            console.log('❌ S3 URL generation failed:', urlError.message);
        }
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
    }
}

testS3API();