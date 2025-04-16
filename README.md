# WebRTC Frontend

A modern, React-based WebRTC application that enables real-time screen sharing and communication between peers in a room.

![WebRTC Frontend Demo](https://via.placeholder.com/800x400?text=WebRTC+Frontend+Demo)

## 🚀 Features

- **Real-time Screen Sharing**: Share your screen with multiple peers simultaneously
- **Room-based Communication**: Join virtual rooms for organized communication
- **Signaling with WebSockets**: Uses STOMP over WebSockets for reliable signaling
- **Adaptive Peer Connections**: Dynamically creates and manages peer connections as users join and leave
- **Automatic Connection Recovery**: Handles unexpected disconnections gracefully
- **Low-Latency Video Streaming**: Optimized for minimal delay in video transmission
- **Responsive UI**: Video containers adapt to available screen space
- **User Presence Awareness**: See who's in the room and their streaming status

## 🛠️ Technical Implementation

### Core WebRTC Components

- **Peer Connection Management**: Dynamically creates, monitors, and cleans up RTCPeerConnection objects
- **ICE Candidate Exchange**: Handles discovery and exchange of ICE candidates for NAT traversal
- **SDP Negotiation**: Properly sequences offer/answer exchanges with precise timing
- **Media Stream Handling**: Captures, transmits, and displays media streams with proper resource cleanup

### Advanced Signaling Logic

- **JOIN Logic**: Optimized signaling for users joining a room with active streams
- **OFFER Handling**: Properly sequences remote description setting and local tracks addition
- **ANSWER Processing**: Manages the SDP answer to complete the connection setup
- **CANDIDATE Processing**: Reliable ICE candidate addition with error handling
- **LEAVE Cleanup**: Proper resource release when peers disconnect

### Connection Optimizations

- **Negotiation Event Handling**: Responds to `onnegotiationneeded` events for dynamic connection updates
- **Connection State Monitoring**: Tracks ICE connection state changes to detect and respond to connectivity issues
- **Delayed Stream Processing**: Uses strategic timeouts to ensure streams are fully ready before display
- **One-Way Streaming Support**: Allows viewing streams without requiring reciprocal streaming

## 📋 Prerequisites

- Node.js 14.x or higher
- npm or yarn
- Modern browser with WebRTC support (Chrome, Firefox, Safari, Edge)

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/webrtc-frontend.git
   cd webrtc-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Configure the backend URL:
   Open `src/Test.tsx` and update the `URL` constant to point to your backend:
   ```typescript
   const URL = "ws://your-backend-url:8080/ws";
   ```

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open your browser to `http://localhost:5173`

## 🔧 Configuration

- **Room Configuration**: By default, the application connects to a room named 'test'. Change the `roomId` constant in `Test.tsx` to use a custom room name.
- **ICE Server Configuration**: The application uses Google's public STUN server. Add TURN servers in the `createPeerConnection` function for improved NAT traversal.

## 📖 Usage

1. Open the application in your browser
2. You'll automatically connect to the default room
3. Click "Start Stream" to begin sharing your screen
4. When others join the room, they'll automatically see your stream
5. If they start streaming, you'll see their stream appear as well

## 🌐 Browser Support

- Chrome 55+
- Firefox 52+
- Safari 11+
- Edge 79+

## 📚 API Reference

### Key Components

- **SignalState Enum**: Defines the types of signals exchanged between peers
  - JOIN: User entering a room
  - OFFER: SDP offer to establish connection
  - ANSWER: SDP answer in response to an offer
  - CANDIDATE: ICE candidate for connection establishment
  - LEAVE: User leaving a room

- **SignalingMessage Interface**: Structure for messages exchanged through the signaling server
  - type: SignalState value
  - sender: Unique ID of the sending user
  - receiver: Target user ID (optional)
  - sdp: Session description for offer/answer (optional)
  - candidate: ICE candidate information (optional)
  - users: List of users in a room (optional)

## 🔍 WebRTC Development Challenges Solved

- **"Black Screen" Issue**: Resolved timing issues that caused received streams to appear blank
- **One-Way Stream Problem**: Fixed SDP negotiation sequence to ensure streams work in all scenarios
- **ICE Connection Failures**: Implemented proper error handling and connection state monitoring
- **Room Management**: Efficient tracking of users joining and leaving rooms
- **Resource Management**: Proper cleanup of media tracks and peer connections to prevent memory leaks