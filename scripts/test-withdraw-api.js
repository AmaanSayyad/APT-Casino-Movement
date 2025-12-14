// Using built-in fetch API (Node.js 18+)

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_PLAYER_ADDRESS = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

/**
 * Enhanced test runner for withdraw API functionality
 */
async function testWithdrawAPI() {
  console.log('🧪 TESTING WITHDRAW API FUNCTIONALITY');
  console.log('=====================================');
  console.log('');

  let testsPassed = 0;
  let testsFailed = 0;

  /**
   * Helper function to run a test case
   */
  async function runTest(testName, testFunction) {
    try {
      console.log(`🔍 Testing: ${testName}`);
      await testFunction();
      console.log(`✅ PASSED: ${testName}`);
      testsPassed++;
    } catch (error) {
      console.log(`❌ FAILED: ${testName}`);
      console.log(`   Error: ${error.message}`);
      testsFailed++;
    }
    console.log('');
  }

  // Test 1: Treasury Balance Check (GET endpoint)
  await runTest('Treasury Balance Check', async () => {
    const response = await fetch(`${BASE_URL}/api/withdraw`, {
      method: 'GET'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
    }
    
    // Validate response structure
    if (!data.treasuryAddress || typeof data.balance !== 'number') {
      throw new Error('Invalid response structure');
    }
    
    console.log(`   Treasury Address: ${data.treasuryAddress}`);
    console.log(`   Balance: ${data.balance} MOVE`);
    console.log(`   Status: ${data.status}`);
    
    if (data.warnings && data.warnings.length > 0) {
      console.log(`   Warnings: ${data.warnings.join(', ')}`);
    }
  });

  // Test 2: Valid Withdrawal Request
  await runTest('Valid Withdrawal Request (Small Amount)', async () => {
    const withdrawalData = {
      playerAddress: TEST_PLAYER_ADDRESS,
      amount: 0.001 // Small test amount
    };
    
    const response = await fetch(`${BASE_URL}/api/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(withdrawalData)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // If it fails due to insufficient balance, that's expected in test environment
      if (data.error && data.error.includes('Insufficient treasury balance')) {
        console.log('   Expected failure: Insufficient treasury balance in test environment');
        return;
      }
      throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
    }
    
    // Validate successful response structure
    if (!data.success || !data.transactionHash || !data.explorerUrl) {
      throw new Error('Invalid success response structure');
    }
    
    console.log(`   Transaction Hash: ${data.transactionHash}`);
    console.log(`   Explorer URL: ${data.explorerUrl}`);
    console.log(`   Processing Time: ${data.processingTimeMs}ms`);
  });

  // Test 3: Invalid Player Address
  await runTest('Invalid Player Address', async () => {
    const withdrawalData = {
      playerAddress: 'invalid-address',
      amount: 1.0
    };
    
    const response = await fetch(`${BASE_URL}/api/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(withdrawalData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      throw new Error('Expected validation error for invalid address');
    }
    
    if (response.status !== 400) {
      throw new Error(`Expected 400 status, got ${response.status}`);
    }
    
    if (!data.error || !data.details) {
      throw new Error('Expected validation error with details');
    }
    
    console.log(`   Validation Error: ${data.error}`);
    console.log(`   Details: ${data.details.join(', ')}`);
  });

  // Test 4: Missing Required Fields
  await runTest('Missing Required Fields', async () => {
    const withdrawalData = {
      // Missing playerAddress and amount
    };
    
    const response = await fetch(`${BASE_URL}/api/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(withdrawalData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      throw new Error('Expected validation error for missing fields');
    }
    
    if (response.status !== 400) {
      throw new Error(`Expected 400 status, got ${response.status}`);
    }
    
    console.log(`   Validation Error: ${data.error}`);
  });

  // Test 5: Invalid Amount (Negative)
  await runTest('Invalid Amount (Negative)', async () => {
    const withdrawalData = {
      playerAddress: TEST_PLAYER_ADDRESS,
      amount: -1.0
    };
    
    const response = await fetch(`${BASE_URL}/api/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(withdrawalData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      throw new Error('Expected validation error for negative amount');
    }
    
    if (response.status !== 400) {
      throw new Error(`Expected 400 status, got ${response.status}`);
    }
    
    console.log(`   Validation Error: ${data.error}`);
  });

  // Test 6: Invalid Amount (Too Large)
  await runTest('Invalid Amount (Too Large)', async () => {
    const withdrawalData = {
      playerAddress: TEST_PLAYER_ADDRESS,
      amount: 10000000 // 10M MOVE tokens (exceeds MAX_WITHDRAWAL_AMOUNT)
    };
    
    const response = await fetch(`${BASE_URL}/api/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(withdrawalData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      throw new Error('Expected validation error for excessive amount');
    }
    
    if (response.status !== 400) {
      throw new Error(`Expected 400 status, got ${response.status}`);
    }
    
    console.log(`   Validation Error: ${data.error}`);
  });

  // Test 7: Invalid JSON Body
  await runTest('Invalid JSON Body', async () => {
    const response = await fetch(`${BASE_URL}/api/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'invalid-json'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      throw new Error('Expected error for invalid JSON');
    }
    
    if (response.status !== 400) {
      throw new Error(`Expected 400 status, got ${response.status}`);
    }
    
    console.log(`   JSON Parse Error: ${data.error}`);
  });

  // Test 8: Very Small Amount (Edge Case)
  await runTest('Very Small Amount (1 octa)', async () => {
    const withdrawalData = {
      playerAddress: TEST_PLAYER_ADDRESS,
      amount: 0.00000001 // 1 octa
    };
    
    const response = await fetch(`${BASE_URL}/api/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(withdrawalData)
    });
    
    const data = await response.json();
    
    // This should pass validation but may fail due to insufficient balance
    if (!response.ok && data.error && data.error.includes('Insufficient treasury balance')) {
      console.log('   Expected failure: Insufficient treasury balance in test environment');
      return;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
    }
    
    console.log(`   Small amount withdrawal validated successfully`);
  });

  // Summary
  console.log('=====================================');
  console.log('🎯 TEST SUMMARY');
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📊 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  
  if (testsFailed === 0) {
    console.log('🎉 ALL TESTS PASSED!');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
  }
}

// Run the tests
testWithdrawAPI().catch(error => {
  console.error('❌ TEST RUNNER FAILED:', error.message);
  process.exit(1);
});