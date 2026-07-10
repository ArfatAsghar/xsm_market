// Test frontend to backend connectivity
console.log('🔧 Testing Frontend to Backend Connectivity');

// Get the API URL from the environment
const API_URL = 'http://localhost:5000/api';
console.log('📡 API URL:', API_URL);

// Test 1: Basic connectivity
async function testBasicConnectivity() {
    console.log('\n🌐 Test 1: Basic Connectivity');
    try {
        const response = await fetch(`${API_URL}/auth/verify-token`, {
            method: 'OPTIONS'
        });
        console.log('✅ Basic connectivity test passed:', {
            status: response.status,
            statusText: response.statusText
        });
        return true;
    } catch (error) {
        console.error('❌ Basic connectivity test failed:', error);
        return false;
    }
}

// Test 2: Google Sign-in Endpoint Accessibility
async function testGoogleSigninEndpoint() {
    console.log('\n🔐 Test 2: Google Sign-in Endpoint');
    try {
        const response = await fetch(`${API_URL}/auth/google-signin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: 'test-token' })
        });
        
        const data = await response.json();
        console.log('✅ Google sign-in endpoint accessible:', {
            status: response.status,
            message: data.message
        });
        
        // Should return 400 with "Invalid token" - this is correct behavior
        if (response.status === 400 && data.message.includes('Invalid token')) {
            console.log('✅ Endpoint is working correctly (rejects invalid tokens)');
            return true;
        } else {
            console.log('⚠️ Unexpected response from endpoint');
            return false;
        }
    } catch (error) {
        console.error('❌ Google sign-in endpoint test failed:', error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.error('🔍 This is the "failed to fetch" error!');
        }
        return false;
    }
}

// Test 3: Check environment variables
function testEnvironmentVariables() {
    console.log('\n⚙️ Test 3: Environment Variables');
    
    // Check if running in development mode
    const isDev = import.meta.env.DEV;
    const apiUrl = import.meta.env.VITE_API_URL;
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    console.log('Environment check:', {
        isDev: isDev,
        VITE_API_URL: apiUrl,
        VITE_GOOGLE_CLIENT_ID: googleClientId ? 'Set' : 'Not set'
    });
    
    return apiUrl === 'http://localhost:5000/api';
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting Frontend-Backend Connectivity Tests\n');
    
    const envTest = testEnvironmentVariables();
    const basicTest = await testBasicConnectivity();
    const googleTest = await testGoogleSigninEndpoint();
    
    console.log('\n📊 Test Results Summary:');
    console.log('Environment Variables:', envTest ? '✅ PASS' : '❌ FAIL');
    console.log('Basic Connectivity:', basicTest ? '✅ PASS' : '❌ FAIL');
    console.log('Google Endpoint:', googleTest ? '✅ PASS' : '❌ FAIL');
    
    if (envTest && basicTest && googleTest) {
        console.log('\n🎉 All tests passed! Frontend can connect to backend.');
        console.log('If you\'re still seeing "failed to fetch", it might be:');
        console.log('1. Browser cache issue - try hard refresh (Ctrl+F5)');
        console.log('2. Browser blocking the request - check browser console');
        console.log('3. Google OAuth library issue - check Google credentials');
    } else {
        console.log('\n⚠️ Some tests failed. Check the specific errors above.');
    }
}

// Run the tests
runAllTests().catch(console.error);
