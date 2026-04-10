import { io } from 'socket.io-client';

// 'autoConnect: false' ensures we only connect when we actually want to (e.g. inside App or authenticated layouts)
const socketURL = process.env.NODE_ENV === 'production' 
  ? window.location.origin
  : 'http://localhost:3001';

export const socket = io(socketURL, {
  autoConnect: false,
  withCredentials: true
});
