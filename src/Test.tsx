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
        peers
    } = useStreaming({ userId, URL, roomId });

    return (
        <div className='home'>
            <div>User ID: {userId}</div>
            <div>Room ID: {roomId} - Users ({peers.length}) {peers.join(",")}</div>
            <div>Status: {isConnected ? 'CONNECTED' : 'NOT CONNECTED'}</div>
            <div>Is Streaming: {isStreaming ? 'YES' : 'NO'}</div>
            <button onClick={startStream}>Start Stream</button>
            {Object.entries(remoteStreams).map(([peerId, stream]) => (
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
            {Object.keys(remoteStreams).length === 0 && (
                <p>No remote streams available.</p>
            )}
        </div>
    )
}
