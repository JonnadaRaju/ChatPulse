let socket = null;

const initializeSocket = () => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    window.location.href = 'index.html';
    return null;
  }

  socket = io('http://127.0.0.1:5000', {
    auth: {
      token: token
    }
  });

  socket.on('connect', () => {
    console.log('Connected to server');
  });

  socket.on('auth:error', (data) => {
    console.error('Auth error:', data.message);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  });

  socket.on('auth:success', (data) => {
    console.log('Authenticated:', data.username);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  return socket;
};

const getSocket = () => socket;

const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

if (typeof window !== 'undefined') {
  window.initializeSocket = initializeSocket;
  window.getSocket = getSocket;
  window.disconnectSocket = disconnectSocket;
}
