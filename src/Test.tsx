import { Client } from '@stomp/stompjs'
import React, { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid';

const URL = "ws://localhost:8080/ws";
const roomId = 'test';
const userId = uuid();

export enum SignalState {
    JOIN = "JOIN",
    OFFER = "OFFER",
    ANSWER = "ANSWER",
    CANDIDATE = "CANDIDATE",
    LEAVE = "LEAVE"
}

export interface SignalingMessage {
    type: SignalState;
    sender: string;
    receiver?: string;
    sdp?: any;
    candidate?: any;
    users?: [];
}

export const Test: React.FC = () => {

    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isStreaming, setIsStreaming] = useState<boolean>(false);
    const [peers, setPeers] = useState<string[]>([]);

    const localStream = useRef<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

    const stompClient = useRef<Client | null>(null);
    const peerConnections = useRef<Record<string, RTCPeerConnection>>({});

    // Connect WebSocket
    const connectWebSocket = () => {
        const client = new Client({
            brokerURL: URL,
            onConnect: () => {
                setIsConnected(true);
                client.subscribe(`/topic/rooms/${roomId}`, (message) => {
                    const signal = JSON.parse(message.body) as SignalingMessage;
                    handleSignal(signal);
                });
                sendSignal({ type: SignalState.JOIN, sender: userId });
            },
            onDisconnect: () => {
                setIsConnected(false);
            }
        });
        client.activate();
        stompClient.current = client;
    }

    const createOffer = async (peerId: string) => {
        const pc = createPeerConnection(peerId);

        // Add all tracks from local stream before creating offer
        if (localStream.current) {
            localStream.current.getTracks().forEach(track =>
                pc.addTrack(track, localStream.current!)
            );
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({ type: SignalState.OFFER, sender: userId, receiver: peerId, sdp: offer });
    }

    // Handles each signal
    const handleSignal = async (signal: SignalingMessage) => {
        if (signal.receiver && signal.receiver !== userId) return;
        console.log(signal);
        switch (signal.type) {
            case SignalState.JOIN: {
                if (signal.users) {
                    setPeers(signal.users);
                    if (signal.sender !== userId && localStream.current) {
                        setTimeout(() => createOffer(signal.sender), 2000);
                    }
                }
                break;
            }
            case SignalState.LEAVE: {
                if (signal.users) {
                    setPeers(signal.users);
                }
                break;
            }
            case SignalState.OFFER: {
                const pc = createPeerConnection(signal.sender);

                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

                if (localStream.current) {
                    localStream.current.getTracks().forEach(track =>
                        pc.addTrack(track, localStream.current!)
                    );
                }

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal({
                    type: SignalState.ANSWER,
                    sender: userId,
                    receiver: signal.sender,
                    sdp: answer
                });

                break;
            }
            case SignalState.ANSWER: {
                const pc = peerConnections.current[signal.sender];
                if (pc && signal.sdp) {
                    pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                }
                break;
            }
            case SignalState.CANDIDATE: {
                const pc = peerConnections.current[signal.sender];
                if (pc && signal.candidate) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                        if (remoteStreams[signal.sender]) {
                            setTimeout(() => {
                                setRemoteStreams(prev => ({
                                    ...prev,
                                    [signal.sender]: { ...prev[signal.sender] }
                                }))
                            }, 1000);
                        }
                    } catch (error) {
                        console.error(`Error adding ICE candidate from ${signal.sender}:`, error);
                    }
                }
                break;
            }

        }
    }

    // Send a signal
    const sendSignal = (signal: SignalingMessage) => {
        stompClient.current?.publish({
            destination: `/app/signal/${roomId}`,
            body: JSON.stringify(signal)
        });
    }

    const startStream = async () => {
        if (!isConnected) return;

        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
        }

        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });

        for (const peer of peers.filter(p => p !== userId)) {
            const pc = createPeerConnection(peer);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            sendSignal({ type: SignalState.OFFER, sender: userId, receiver: peer, sdp: offer });
        }

        localStream.current = stream;
        setIsStreaming(true);
    }

    const createPeerConnection = (peerId: string): RTCPeerConnection => {
        // Close existing connection
        if (peerConnections.current[peerId]) {
            peerConnections.current[peerId].close();
        }

        // New connection
        const connection = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" }
            ]
        });

        // Using ICE Candidate to bridge a connection discover public IP address
        connection.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({
                    type: SignalState.CANDIDATE,
                    sender: userId,
                    candidate: event.candidate,
                    receiver: peerId
                })
            }
        }

        // Callback if received any connections
        connection.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                const stream = event.streams[0];
                if (stream.getTracks().length > 0) {

                    setRemoteStreams(prev => ({
                        ...prev,
                        [peerId]: stream
                    }))

                    setTimeout(() => {
                        setRemoteStreams(prev => {
                            if (prev[peerId]) {
                                return {
                                    ...prev,
                                    [peerId]: stream
                                };
                            }
                            return prev;
                        })
                    }, 2000);
                }
            }
        }

        // Negotiation needed
        connection.onnegotiationneeded = async () => {
            console.log(`Negotiation needed for peer ${peerId}`);
            try {
                const offer = await connection.createOffer();
                await connection.setLocalDescription(offer);
                sendSignal({
                    type: SignalState.OFFER,
                    sender: userId,
                    receiver: peerId,
                    sdp: connection.localDescription
                });
            } catch (err) {
                console.error("Error during negotiation:", err);
            }
        }

        // Callback handle disconnects
        connection.oniceconnectionstatechange = () => {
            if (connection.iceConnectionState === 'disconnected' ||
                connection.iceConnectionState === 'failed' ||
                connection.iceConnectionState === 'closed') {
                setRemoteStreams(prev => {
                    const newStreams = { ...prev };
                    delete newStreams[peerId];
                    return newStreams;
                });
            }
        };

        peerConnections.current[peerId] = connection;
        return connection;
    }

    useEffect(() => {
        if (!isConnected) {
            connectWebSocket();
        }
    }, [isConnected]);

    // Clean-up
    useEffect(() => {
        const handleBeforeUnload = () => {
            sendSignal({ type: SignalState.LEAVE, sender: userId });
            stompClient.current?.deactivate();
            localStream.current?.getTracks().forEach(track => track.stop());
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            handleBeforeUnload(); // Also run it when component unmounts
        };
    }, [])

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
