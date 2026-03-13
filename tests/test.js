const http = require('http');
const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

const log = (message) => console.log(`[TEST] ${message}`);
const logSuccess = (testName) => {
  console.log(`✓ PASS: ${testName}`);
  testResults.passed++;
  testResults.tests.push({ name: testName, status: 'PASS' });
};
const logFail = (testName, reason) => {
  console.log(`✗ FAIL: ${testName} - ${reason}`);
  testResults.failed++;
  testResults.tests.push({ name: testName, status: 'FAIL', reason });
};

let authToken = null;
let testUserEmail = null;
let testUserUsername = null;
let testUserPassword = 'password123';
let roomId = null;
let testMessageId = null;
let socket = null;

async function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    const urlPath = path.startsWith('/') ? path : '/' + path;
    const url = new URL(baseUrl + urlPath);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data || '{}') });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function connectSocket(token) {
  return new Promise((resolve, reject) => {
    socket = io(BASE_URL, {
      auth: { token },
      transports: ['websocket']
    });

    socket.on('connect', () => {
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      reject(err);
    });

    socket.on('auth:error', (data) => {
      reject(new Error(data.message));
    });

    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

async function testServerRunning() {
  try {
    const response = await makeRequest('GET', '/auth');
    logSuccess('TEST 1: Server is running');
    return true;
  } catch {
    logFail('TEST 1: Server is running', 'Server not reachable');
    return false;
  }
}

async function testRegisterNewUser() {
  const uniqueId = Date.now();
  testUserUsername = 'testuser' + uniqueId;
  testUserEmail = 'test' + uniqueId + '@example.com';
  const response = await makeRequest('POST', 'auth/register', {
    username: testUserUsername,
    email: testUserEmail,
    password: testUserPassword
  });

  if (response.status === 201 && response.data.token) {
    authToken = response.data.token;
    logSuccess('TEST 2: Register new user');
    return true;
  }
  logFail('TEST 2: Register new user', `Status: ${response.status}`);
  return false;
}

async function testDuplicateRegistration() {
  const response = await makeRequest('POST', 'auth/register', {
    username: testUserUsername,
    email: testUserEmail,
    password: testUserPassword
  });

  if (response.status === 409) {
    logSuccess('TEST 3: Duplicate registration');
    return true;
  }
  logFail('TEST 3: Duplicate registration', `Status: ${response.status}`);
  return false;
}

async function testLoginValidCredentials() {
  const response = await makeRequest('POST', 'auth/login', {
    email: testUserEmail,
    password: testUserPassword
  });

  if (response.status === 200 && response.data.token) {
    authToken = response.data.token;
    logSuccess('TEST 4: Login with valid credentials');
    return true;
  }
  logFail('TEST 4: Login with valid credentials', `Status: ${response.status}`);
  return false;
}

async function testLoginWrongPassword() {
  const response = await makeRequest('POST', 'auth/login', {
    email: testUserEmail,
    password: 'wrongpassword'
  });

  if (response.status === 401) {
    logSuccess('TEST 5: Login with wrong password');
    return true;
  }
  logFail('TEST 5: Login with wrong password', `Status: ${response.status}`);
  return false;
}

async function testProtectedRouteWithToken() {
  const response = await makeRequest('GET', '/auth/me', null, authToken);

  if (response.status === 200 && response.data.user) {
    logSuccess('TEST 6: Access protected route with token');
    return true;
  }
  logFail('TEST 6: Access protected route with token', `Status: ${response.status}`);
  return false;
}

async function testProtectedRouteWithoutToken() {
  const response = await makeRequest('GET', '/auth/me');

  if (response.status === 401) {
    logSuccess('TEST 7: Access protected route without token');
    return true;
  }
  logFail('TEST 7: Access protected route without token', `Status: ${response.status}`);
  return false;
}

async function testCreateChatRoom() {
  const response = await makeRequest('POST', '/rooms/create', {
    name: 'test-room-' + Date.now(),
    description: 'Test room',
    isPrivate: false
  }, authToken);

  if (response.status === 201 && response.data.room) {
    roomId = response.data.room._id;
    logSuccess('TEST 8: Create chat room');
    return true;
  }
  logFail('TEST 8: Create chat room', `Status: ${response.status}`);
  return false;
}

async function testListRooms() {
  const response = await makeRequest('GET', '/rooms', null, authToken);

  if (response.status === 200 && response.data.rooms) {
    const found = response.data.rooms.some(r => r._id === roomId);
    if (found) {
      logSuccess('TEST 9: List rooms');
      return true;
    }
    logFail('TEST 9: List rooms', 'Created room not in list');
    return false;
  }
  logFail('TEST 9: List rooms', `Status: ${response.status}`);
  return false;
}

async function testSocketConnectionValidToken() {
  try {
    await connectSocket(authToken);
    logSuccess('TEST 10: Socket connection with valid token');
    return true;
  } catch (err) {
    logFail('TEST 10: Socket connection with valid token', err.message);
    return false;
  }
}

async function testSocketConnectionInvalidToken() {
  return new Promise((resolve) => {
    const badSocket = io(BASE_URL, {
      auth: { token: 'invalid-token' },
      transports: ['polling']
    });

    badSocket.on('connect_error', (err) => {
      if (err.message === 'Invalid token' || err.message === 'Authentication required') {
        logSuccess('TEST 11: Socket connection with invalid token');
        badSocket.disconnect();
        resolve(true);
      }
    });

    setTimeout(() => {
      if (badSocket.connected) {
        badSocket.disconnect();
      }
      logFail('TEST 11: Socket connection with invalid token', 'Timeout');
      resolve(false);
    }, 5000);
  });
}

async function testJoinRoomViaSocket() {
  return new Promise((resolve) => {
    if (!socket) {
      logFail('TEST 12: Join room via socket', 'No socket');
      resolve(false);
      return;
    }

    let resolved = false;
    const handleSuccess = () => {
      if (resolved) return;
      resolved = true;
      socket.off('room:user-joined', handleUserJoined);
      socket.off('room:messages', handleMessages);
      logSuccess('TEST 12: Join room via socket');
      resolve(true);
    };

    const handleUserJoined = (data) => {
      if (data.roomId === roomId) handleSuccess();
    };
    const handleMessages = (data) => {
      if (data.roomId === roomId) handleSuccess();
    };

    socket.on('room:user-joined', handleUserJoined);
    socket.on('room:messages', handleMessages);
    socket.emit('room:join', { roomId });

    setTimeout(() => {
      if (!resolved) {
        socket.off('room:user-joined', handleUserJoined);
        socket.off('room:messages', handleMessages);
        logFail('TEST 12: Join room via socket', 'Timeout');
        resolve(false);
      }
    }, 5000);
  });
}

async function testSendMessageViaSocket() {
  return new Promise((resolve) => {
    if (!socket) {
      logFail('TEST 13: Send message via socket', 'No socket');
      resolve(false);
      return;
    }

    let resolved = false;
    const testMessage = 'Test message ' + Date.now();

    const handleReceive = (data) => {
      if (resolved) return;
      if (data.roomId === roomId && data.content === testMessage) {
        resolved = true;
        socket.off('message:receive', handleReceive);
        testMessageId = data.messageId;
        logSuccess('TEST 13: Send message via socket');
        resolve(true);
      }
    };

    socket.on('message:receive', handleReceive);
    socket.emit('message:send', {
      roomId,
      content: testMessage,
      type: 'text'
    });

    setTimeout(() => {
      if (!resolved) {
        socket.off('message:receive', handleReceive);
        logFail('TEST 13: Send message via socket', 'Timeout');
        resolve(false);
      }
    }, 5000);
  });
}

async function testTypingIndicator() {
  return new Promise((resolve) => {
    const secondSocket = io(BASE_URL, {
      auth: { token: authToken },
      transports: ['polling']
    });

    secondSocket.on('connect', () => {
      secondSocket.emit('room:join', { roomId });

      secondSocket.on('room:messages', () => {
        let resolved = false;
        const handleTyping = (data) => {
          if (resolved) return;
          if (data.roomId === roomId) {
            resolved = true;
            secondSocket.off('message:user-typing', handleTyping);
            secondSocket.disconnect();
            logSuccess('TEST 14: Typing indicator');
            resolve(true);
          }
        };

        secondSocket.on('message:user-typing', handleTyping);
        socket.emit('message:typing', { roomId });

        setTimeout(() => {
          if (!resolved) {
            secondSocket.off('message:user-typing', handleTyping);
            secondSocket.disconnect();
            logFail('TEST 14: Typing indicator', 'Timeout');
            resolve(false);
          }
        }, 5000);
      });
    });
  });
}

async function testFetchMessageHistory() {
  const response = await makeRequest('GET', `/rooms/${roomId}/messages`, null, authToken);

  if (response.status === 200 && response.data.messages) {
    logSuccess('TEST 15: Fetch message history');
    return true;
  }
  logFail('TEST 15: Fetch message history', `Status: ${response.status}`);
  return false;
}

async function testDeleteMessage() {
  if (!testMessageId || !socket) {
    logFail('TEST 16: Delete message', 'No message to delete');
    return false;
  }

  return new Promise((resolve) => {
    socket.emit('message:delete', { messageId: testMessageId });

    socket.on('message:deleted', (data) => {
      if (data.messageId === testMessageId) {
        logSuccess('TEST 16: Delete message');
        resolve(true);
      }
    });

    setTimeout(() => {
      logFail('TEST 16: Delete message', 'Timeout');
      resolve(false);
    }, 5000);
  });
}

async function runTests() {
  console.log('\n========================================');
  console.log('Starting Test Suite');
  console.log('========================================\n');

  const serverRunning = await testServerRunning();
  if (!serverRunning) {
    console.log('\n========================================');
    console.log('ERROR: Server not running');
    console.log('Please start the server with: node server/index.js');
    console.log('========================================\n');
    process.exit(1);
  }

  await testRegisterNewUser();
  await testDuplicateRegistration();
  await testLoginValidCredentials();
  await testLoginWrongPassword();
  await testProtectedRouteWithToken();
  await testProtectedRouteWithoutToken();
  await testCreateChatRoom();
  await testListRooms();
  await testSocketConnectionValidToken();
  await testSocketConnectionInvalidToken();
  await testJoinRoomViaSocket();
  await testSendMessageViaSocket();
  await testTypingIndicator();
  await testFetchMessageHistory();
  await testDeleteMessage();

  if (socket) {
    socket.disconnect();
  }

  console.log('\n========================================');
  console.log('TEST RESULTS SUMMARY');
  console.log(`PASSED: ${testResults.passed} / ${testResults.passed + testResults.failed}`);
  console.log(`FAILED: ${testResults.failed} / ${testResults.passed + testResults.failed}`);
  console.log('========================================\n');

  if (testResults.failed > 0) {
    console.log('Failed tests:');
    testResults.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => console.log(`  - ${t.name}: ${t.reason}`));
  }

  process.exit(testResults.failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
