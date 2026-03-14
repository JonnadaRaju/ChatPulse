const API_URL = 'http://127.0.0.1:5000/api';

let currentRoomId = null;
let typingTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));

  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  const socket = initializeSocket();

  await loadRooms();

  document.getElementById('create-room-btn').addEventListener('click', () => {
    document.getElementById('create-room-modal').classList.remove('hidden');
  });

  document.getElementById('join-room-btn').addEventListener('click', () => {
    document.getElementById('join-room-modal').classList.remove('hidden');
  });

  document.getElementById('cancel-room-btn').addEventListener('click', () => {
    document.getElementById('create-room-modal').classList.add('hidden');
  });

  document.getElementById('cancel-join-btn').addEventListener('click', () => {
    document.getElementById('join-room-modal').classList.add('hidden');
  });

  document.getElementById('create-room-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await createRoom();
  });

  document.getElementById('join-room-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await joinRoomByCode();
  });

  document.getElementById('copy-invite-btn').addEventListener('click', () => {
    const code = document.getElementById('invitation-code-display').textContent;
    navigator.clipboard.writeText(code);
    alert('Invitation code copied!');
  });

  document.getElementById('regenerate-invite-btn').addEventListener('click', async () => {
    await regenerateInvitationCode();
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket();
    window.location.href = 'index.html';
  });

  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');

  messageInput.addEventListener('input', () => {
    if (currentRoomId && socket) {
      socket.emit('message:typing', { roomId: currentRoomId });
      
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      typingTimeout = setTimeout(() => {
        socket.emit('message:stop-typing', { roomId: currentRoomId });
      }, 1000);
    }
  });

  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !currentRoomId || !socket) return;

    socket.emit('message:send', {
      roomId: currentRoomId,
      content: content,
      type: 'text'
    });

    messageInput.value = '';
    socket.emit('message:stop-typing', { roomId: currentRoomId });
  }

  socket.on('message:receive', (data) => {
    if (data.roomId === currentRoomId) {
      appendMessage(data);
      socket.emit('message:seen', { messageId: data.messageId });
    }
  });

  socket.on('message:user-typing', (data) => {
    if (data.roomId === currentRoomId && data.userId !== user.id) {
      showTypingIndicator(data.username);
    }
  });

  socket.on('message:user-stop-typing', (data) => {
    if (data.roomId === currentRoomId) {
      hideTypingIndicator();
    }
  });

  socket.on('message:deleted', (data) => {
    const messageEl = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageEl) {
      messageEl.remove();
    }
  });

  socket.on('room:user-joined', async (data) => {
    if (data.roomId === currentRoomId) {
      await loadRooms();
    }
  });

  socket.on('room:user-left', async (data) => {
    if (data.roomId === currentRoomId) {
      await loadRooms();
    }
  });

  socket.on('user:online', (data) => {
    updateUserOnlineStatus(data.userId, true);
  });

  socket.on('user:offline', (data) => {
    updateUserOnlineStatus(data.userId, false);
  });
});

async function loadRooms() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/rooms`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    renderRooms(data.rooms);
  } catch (error) {
    console.error('Failed to load rooms:', error);
  }
}

function renderRooms(rooms) {
  const roomsList = document.getElementById('rooms-list');
  roomsList.innerHTML = '';
  const user = JSON.parse(localStorage.getItem('user'));

  rooms.forEach(room => {
    const roomEl = document.createElement('div');
    roomEl.className = 'room-item';
    roomEl.dataset.roomId = room._id;
    roomEl.dataset.isCreator = String(room.createdBy?._id || room.createdBy) === String(user.id);
    
    const memberCount = room.members ? room.members.length : 0;
    const creatorId = room.createdBy ? room.createdBy._id : room.createdBy;
    const isCreator = creatorId && String(creatorId) === String(user.id);
    
    roomEl.innerHTML = `
      <h3>${room.name}</h3>
      <p>${room.description || 'No description'} • ${memberCount} members</p>
      ${isCreator ? '<button class="delete-room-btn">Delete</button>' : ''}
    `;

    roomEl.addEventListener('click', (e) => {
      if (!e.target.classList.contains('delete-room-btn')) {
        joinRoom(room._id, room.name, room.invitationCode);
      }
    });

    const deleteBtn = roomEl.querySelector('.delete-room-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteRoom(room._id);
      });
    }

    roomsList.appendChild(roomEl);
  });
}

async function joinRoom(roomId, roomName, invitationCode = null) {
  const token = localStorage.getItem('token');
  const socket = window.getSocket();
  const user = JSON.parse(localStorage.getItem('user'));

  document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`[data-room-id="${roomId}"]`)?.classList.add('active');

  currentRoomId = roomId;
  document.getElementById('current-room-name').textContent = roomName;
  document.getElementById('message-input').disabled = false;
  document.getElementById('send-btn').disabled = false;

  const inviteSection = document.getElementById('room-invite-section');
  const inviteCodeDisplay = document.getElementById('invitation-code-display');
  const regenerateBtn = document.getElementById('regenerate-invite-btn');

  if (!invitationCode) {
    try {
      const response = await fetch(`${API_URL}/rooms`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      const room = data.rooms.find(r => r._id === roomId);
      if (room) {
        invitationCode = room.invitationCode;
      }
    } catch (error) {
      console.error('Failed to get room details:', error);
    }
  }

  const isCreator = document.querySelector(`[data-room-id="${roomId}"]`)?.dataset.isCreator === 'true' || 
    (invitationCode && room && String(room.createdBy?._id || room.createdBy) === String(user.id));

  if (isCreator && invitationCode) {
    inviteSection.classList.remove('hidden');
    inviteCodeDisplay.textContent = invitationCode;
    regenerateBtn.classList.remove('hidden');
  } else {
    inviteSection.classList.add('hidden');
  }

  socket.emit('room:join', { roomId });

  socket.once('room:messages', (data) => {
    if (data.roomId === roomId) {
      renderMessages(data.messages);
    }
  });

  await loadRoomMessages(roomId);
}

async function loadRoomMessages(roomId) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    renderMessages(data.messages);
  } catch (error) {
    console.error('Failed to load messages:', error);
  }
}

function renderMessages(messages) {
  const messagesEl = document.getElementById('messages');
  messagesEl.innerHTML = '';

  messages.forEach(msg => {
    appendMessage({
      messageId: msg._id,
      content: msg.content,
      sender: {
        id: msg.sender._id,
        username: msg.sender.username,
        avatar: msg.sender.avatar
      },
      createdAt: msg.createdAt,
      status: msg.status
    });
  });

  scrollToBottom();
}

function appendMessage(data) {
  const user = JSON.parse(localStorage.getItem('user'));
  const isOwn = data.sender.id === user.id;
  
  const messagesEl = document.getElementById('messages');
  const messageEl = document.createElement('div');
  messageEl.className = `message ${isOwn ? 'own' : 'other'}`;
  messageEl.dataset.messageId = data.messageId;

  const time = new Date(data.createdAt).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  messageEl.innerHTML = `
    <div class="message-header">
      <img src="${data.sender.avatar}" alt="${data.sender.username}" class="message-avatar">
      <span class="message-username">${data.sender.username}</span>
    </div>
    <div class="message-content">${escapeHtml(data.content)}</div>
    <div class="message-time">
      ${time}
      ${isOwn ? `<span class="message-status">✓✓</span>` : ''}
    </div>
  `;

  messagesEl.appendChild(messageEl);
  scrollToBottom();
}

function scrollToBottom() {
  const container = document.getElementById('messages-container');
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator(username) {
  const indicator = document.getElementById('typing-indicator');
  document.getElementById('typing-user').textContent = username;
  indicator.classList.remove('hidden');
  scrollToBottom();
}

function hideTypingIndicator() {
  document.getElementById('typing-indicator').classList.add('hidden');
}

async function createRoom() {
  const token = localStorage.getItem('token');
  const name = document.getElementById('room-name').value;
  const description = document.getElementById('room-description').value;
  const isPrivate = document.getElementById('room-private').checked;

  try {
    const response = await fetch(`${API_URL}/rooms/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, description, isPrivate })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);
      return;
    }

    document.getElementById('create-room-modal').classList.add('hidden');
    document.getElementById('create-room-form').reset();
    await loadRooms();
    joinRoom(data.room._id, data.room.name, data.room.invitationCode);
    
    alert(`Room created! Share this invitation code: ${data.room.invitationCode}`);
  } catch (error) {
    console.error('Failed to create room:', error);
    alert('Failed to create room');
  }
}

async function deleteRoom(roomId) {
  const token = localStorage.getItem('token');
  
  if (!confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);
      return;
    }

    if (currentRoomId === roomId) {
      currentRoomId = null;
      document.getElementById('current-room-name').textContent = 'Select a room';
      document.getElementById('messages').innerHTML = '';
      document.getElementById('message-input').disabled = true;
      document.getElementById('send-btn').disabled = true;
      document.getElementById('room-invite-section').classList.add('hidden');
    }

    await loadRooms();
  } catch (error) {
    console.error('Failed to delete room:', error);
    alert('Failed to delete room');
  }
}

function updateUserOnlineStatus(userId, isOnline) {
  const userEl = document.querySelector(`[data-user-id="${userId}"]`);
  if (userEl) {
    const indicator = userEl.querySelector('.online-indicator');
    if (indicator) {
      indicator.style.background = isOnline ? '#4caf50' : '#888';
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function joinRoomByCode() {
  const token = localStorage.getItem('token');
  const invitationCode = document.getElementById('invitation-code').value.trim();

  if (!invitationCode) {
    alert('Please enter an invitation code');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/rooms/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ invitationCode })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);
      return;
    }

    document.getElementById('join-room-modal').classList.add('hidden');
    document.getElementById('join-room-form').reset();
    await loadRooms();
    joinRoom(data.room._id, data.room.name, data.room.invitationCode);
  } catch (error) {
    console.error('Failed to join room:', error);
    alert('Failed to join room');
  }
}

async function regenerateInvitationCode() {
  const token = localStorage.getItem('token');
  
  if (!confirm('This will regenerate a new invitation code. The old code will no longer work. Continue?')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/rooms/${currentRoomId}/regenerate-code`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);
      return;
    }

    document.getElementById('invitation-code-display').textContent = data.invitationCode;
    alert(`New invitation code: ${data.invitationCode}`);
  } catch (error) {
    console.error('Failed to regenerate invitation code:', error);
    alert('Failed to regenerate invitation code');
  }
}
