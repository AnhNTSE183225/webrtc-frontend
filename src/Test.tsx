import React from 'react'
import { v4 as uuid } from 'uuid';
import { useStreaming } from './components/useStreamingV2';

const URL = "ws://localhost:8080/ws";
const roomId = 'test';
const userId = uuid();

export const Test: React.FC = () => {

    const {
        isConnected,
        isStreaming,
        startStream,
        remoteStreams,
        activeStreams,
        peers,
        streamers
    } = useStreaming({ userId, URL, roomId });

    return (
        <div className='home'>
            <div>User ID: {userId}</div>
            <div>Room ID: {roomId} - Users ({peers.length}) {peers.join(" | ")}</div>
            <div>Status: {isConnected ? 'CONNECTED' : 'NOT CONNECTED'}</div>
            <div>Is Streaming: {isStreaming ? 'YES' : 'NO'}</div>
            <div>Streamers: {streamers.join(" | ")}</div>
            <div>WebRTC users connected: {Object.entries(remoteStreams).length}</div>
            <button onClick={startStream} disabled={isStreaming}>{isStreaming ? 'You are streaming' : 'Start Stream'}</button>

            {Object.entries(activeStreams).map(([peerId, stream]) => (
                <div key={peerId} style={{ marginBottom: "20px" }}>
                    <p>User: {peerId}</p>
                    <video
                        autoPlay
                        playsInline
                        style={{ width: "400px", border: "1px solid blue" }}
                        ref={(video) => {
                            if (video) {
                                video.srcObject = stream;
                            }
                        }}
                    ></video>
                </div>
            ))}
            {Object.keys(activeStreams).length === 0 && (
                <p>No remote streams available.</p>
            )}
        </div>
    )
}
